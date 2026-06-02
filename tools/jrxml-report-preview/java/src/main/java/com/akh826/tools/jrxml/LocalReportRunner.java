package com.akh826.tools.jrxml;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.reflect.TypeToken;
import net.sf.jasperreports.engine.JREmptyDataSource;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperReport;

import java.io.File;
import java.io.FileReader;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.DriverManager;
import java.text.SimpleDateFormat;
import java.util.HashMap;
import java.util.Map;

public final class LocalReportRunner {
    private static final Gson GSON = new Gson();
    private static final Type MAP_TYPE = new TypeToken<Map<String, JsonElement>>() {}.getType();

    public static void main(String[] args) {
        try {
            String jrxmlPath = null;
            String paramsPath = null;
            String outputPath = null;
            String jdbcUrl = null;
            String jdbcUser = null;
            String jdbcPassword = null;
            String jdbcDriver = null;

            for (int index = 0; index < args.length; index += 1) {
                String arg = args[index];
                switch (arg) {
                    case "--jrxml":
                        jrxmlPath = nextArg(args, index, arg);
                        index += 1;
                        break;
                    case "--params":
                        paramsPath = nextArg(args, index, arg);
                        index += 1;
                        break;
                    case "--output":
                        outputPath = nextArg(args, index, arg);
                        index += 1;
                        break;
                    case "--jdbc-url":
                        jdbcUrl = nextArg(args, index, arg);
                        index += 1;
                        break;
                    case "--jdbc-user":
                        jdbcUser = nextArg(args, index, arg);
                        index += 1;
                        break;
                    case "--jdbc-password":
                        jdbcPassword = nextArg(args, index, arg);
                        index += 1;
                        break;
                    case "--jdbc-driver":
                        jdbcDriver = nextArg(args, index, arg);
                        index += 1;
                        break;
                    default:
                        throw new IllegalArgumentException("Unknown argument: " + arg);
                }
            }

            if (jrxmlPath == null || paramsPath == null || outputPath == null) {
                throw new IllegalArgumentException("Required: --jrxml, --params, --output");
            }

            run(jrxmlPath, paramsPath, outputPath, jdbcUrl, jdbcUser, jdbcPassword, jdbcDriver);
            System.out.println("OK: " + outputPath);
        } catch (Exception error) {
            System.err.println(error.getMessage());
            error.printStackTrace(System.err);
            System.exit(1);
        }
    }

    private static String nextArg(String[] args, int index, String flag) {
        if (index + 1 >= args.length) {
            throw new IllegalArgumentException("Missing value for " + flag);
        }
        return args[index + 1];
    }

    private static void run(
            String jrxmlPath,
            String paramsPath,
            String outputPath,
            String jdbcUrl,
            String jdbcUser,
            String jdbcPassword,
            String jdbcDriver
    ) throws Exception {
        File jrxmlFile = new File(jrxmlPath);
        if (!jrxmlFile.isFile()) {
            throw new IllegalArgumentException("JRXML not found: " + jrxmlPath);
        }

        Map<String, Object> parameters = loadParameters(paramsPath);
        String reportDir = jrxmlFile.getParentFile().getAbsolutePath() + File.separator;
        parameters.putIfAbsent("SUBREPORT_DIR", reportDir);
        parameters.putIfAbsent("REPORT_DIR", reportDir);

        JasperReport report = JasperCompileManager.compileReport(jrxmlFile.getAbsolutePath());
        JasperPrint print;

        if (jdbcUrl != null && !jdbcUrl.isBlank()) {
            if (jdbcDriver != null && !jdbcDriver.isBlank()) {
                Class.forName(jdbcDriver);
            }
            try (Connection connection = DriverManager.getConnection(
                    jdbcUrl,
                    jdbcUser == null ? "" : jdbcUser,
                    jdbcPassword == null ? "" : jdbcPassword
            )) {
                print = JasperFillManager.fillReport(report, parameters, connection);
            }
        } else {
            print = JasperFillManager.fillReport(report, parameters, new JREmptyDataSource(1));
        }

        File outputFile = new File(outputPath);
        File parent = outputFile.getParentFile();
        if (parent != null) {
            Files.createDirectories(parent.toPath());
        }

        JasperExportManager.exportReportToPdfFile(print, outputFile.getAbsolutePath());
    }

    private static Map<String, Object> loadParameters(String paramsPath) throws Exception {
        File paramsFile = new File(paramsPath);
        if (!paramsFile.isFile()) {
            return new HashMap<>();
        }

        Map<String, JsonElement> raw;
        try (FileReader reader = new FileReader(paramsFile, StandardCharsets.UTF_8)) {
            raw = GSON.fromJson(reader, MAP_TYPE);
        }

        Map<String, Object> parameters = new HashMap<>();
        if (raw == null) {
            return parameters;
        }

        for (Map.Entry<String, JsonElement> entry : raw.entrySet()) {
            parameters.put(entry.getKey(), convertJsonValue(entry.getValue()));
        }
        return parameters;
    }

    private static Object convertJsonValue(JsonElement element) {
        if (element == null || element.isJsonNull()) {
            return null;
        }
        if (element.isJsonPrimitive()) {
            if (element.getAsJsonPrimitive().isBoolean()) {
                return element.getAsBoolean();
            }
            if (element.getAsJsonPrimitive().isNumber()) {
                Number number = element.getAsNumber();
                if (number instanceof Integer || number.longValue() == number.intValue()) {
                    return number.intValue();
                }
                return number.doubleValue();
            }
            String text = element.getAsString();
            java.util.Date parsedDate = tryParseDate(text);
            return parsedDate == null ? text : parsedDate;
        }
        if (element.isJsonObject() || element.isJsonArray()) {
            return GSON.fromJson(element, Object.class);
        }
        return element.toString();
    }

    private static java.util.Date tryParseDate(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String[] patterns = { "yyyy-MM-dd", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss" };
        for (String pattern : patterns) {
            try {
                return new SimpleDateFormat(pattern).parse(text.trim());
            } catch (Exception ignored) {
                // try next pattern
            }
        }
        return null;
    }
}
