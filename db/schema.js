"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookings = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    username: (0, pg_core_1.text)("username").notNull(),
    passwordHash: (0, pg_core_1.text)("password_hash").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    isAdmin: (0, pg_core_1.boolean)("is_admin").default(false).notNull(),
});
exports.bookings = (0, pg_core_1.pgTable)("bookings", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    room: (0, pg_core_1.text)("room").notNull(), // "Room 1", "Room 2", or "Room 3"
    title: (0, pg_core_1.text)("title").notNull(),
    startTime: (0, pg_core_1.timestamp)("start_time").notNull(),
    endTime: (0, pg_core_1.timestamp)("end_time").notNull(),
    bookedBy: (0, pg_core_1.text)("booked_by").notNull(), // email of the booking user
    status: (0, pg_core_1.text)("status").default("active").notNull(), // "active" or "cancelled"
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
