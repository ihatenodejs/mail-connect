import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey(),
  email: text("email").notNull().unique(),
  used: text("used").notNull(),
  capacity: text("capacity").notNull(),
  percentage: text("percentage").notNull(),
})

export const cacheInfo = sqliteTable("cache_info", {
  id: integer("id").primaryKey(),
  lastUpdated: integer("last_updated").notNull(),
})

