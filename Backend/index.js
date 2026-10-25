const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const session = require("express-session");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./database/connectDB");
const requireAdmin = require("./middleware/requireAdmin");

const authRoutes = require("./apiRoutes/authRoutes");
const ingredientRoutes = require("./apiRoutes/ingredientRoutes");
const supplierRoutes = require("./apiRoutes/supplierRoutes");
const stockBatchRoutes = require("./apiRoutes/stockBatchRoutes");
const stockMovementRoutes = require("./apiRoutes/stockMovementRoutes");
const stockQuantityRoutes = require("./apiRoutes/stockQuantityRoutes");
const stockAlertRoutes = require("./apiRoutes/stockAlertRoutes");
const dashboardRoutes = require("./apiRoutes/dashboardRoutes");
const inventoryReportRoutes = require("./apiRoutes/inventoryReportRoutes");
const selfHealingRoutes = require("./apiRoutes/selfHealingRoutes");
const failureSimulatorRoutes = require("./apiRoutes/failureSimulatorRoutes");
const offlineInventoryRoutes = require("./apiRoutes/offlineInventoryRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing from Backend/.env");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    if (req.path === "/api/auth/login" && req.method === "POST") {
        console.log("Login Content-Type:", req.headers["content-type"]);
        console.log("Login Request Body:", req.body);
    }
    next();
});
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true
    })
);

app.use(
    session({
        name: "resilio.sid",
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 8
        }
    })
);

// Request logger
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
    next();
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Protected inventory routes
app.use("/api/ingredients", requireAdmin, ingredientRoutes);
app.use("/api/suppliers", requireAdmin, supplierRoutes);
app.use("/api/stock-batches", requireAdmin, stockBatchRoutes);
app.use("/api/stock-movements", requireAdmin, stockMovementRoutes);
app.use("/api/stock-quantities", requireAdmin, stockQuantityRoutes);
app.use("/api/stock-alerts", requireAdmin, stockAlertRoutes);
app.use("/api/dashboard", requireAdmin, dashboardRoutes);
app.use("/api/reports/inventory", requireAdmin, inventoryReportRoutes);

// Self-healing and failure simulation routes
app.use("/api/admin/failures", selfHealingRoutes);
app.use("/api/admin/simulator", failureSimulatorRoutes);

// Protected offline inventory routes
app.use("/api/admin/inventory", requireAdmin, offlineInventoryRoutes);

// Backend health check
app.get("/", (req, res) => {
    res.send("Resilio Backend is running successfully!");
});

// Start server after database connection
const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Resilio server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Could not start Resilio:", error.message);
        process.exit(1);
    }
};

startServer();
