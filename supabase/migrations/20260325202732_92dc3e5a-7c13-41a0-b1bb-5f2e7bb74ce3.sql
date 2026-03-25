DROP POLICY IF EXISTS "Only admins can view devices" ON devices;
CREATE POLICY "Authenticated users can view devices" ON devices FOR SELECT TO authenticated USING (true);