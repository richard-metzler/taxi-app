CREATE UNIQUE INDEX "declined_orders_driver_order_idx" ON "declined_orders" USING btree ("driver_id","order_id");--> statement-breakpoint
CREATE INDEX "orders_driver_status_idx" ON "orders" USING btree ("driver_id","status");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_one_active_per_passenger_idx" ON "orders" USING btree ("passenger_id") WHERE "orders"."status" IN ('searching', 'driver_assigned', 'driver_arriving', 'driver_waiting', 'in_progress');--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");