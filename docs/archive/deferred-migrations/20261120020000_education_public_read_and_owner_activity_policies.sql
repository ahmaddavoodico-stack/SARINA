-- SARINA education access policies. Runs after the compatible education schema migration.
-- Public users read active taxonomy and published content only.
-- Authenticated users manage only their own learning activity and pending reviews.
BEGIN;
REVOKE ALL ON TABLE public.educational_categories, public.educational_category_localizations, public.educational_content_providers, public.educational_contents, public.educational_content_localizations, public.educational_lessons, public.educational_lesson_localizations, public.user_content_progress, public.user_content_bookmarks, public.educational_content_reviews FROM anon, authenticated;
GRANT SELECT ON TABLE public.educational_categories, public.educational_category_localizations, public.educational_content_providers, public.educational_contents, public.educational_content_localizations, public.educational_lessons, public.educational_lesson_localizations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_content_progress, public.user_content_bookmarks, public.educational_content_reviews TO authenticated;
GRANT ALL ON TABLE public.educational_categories, public.educational_category_localizations, public.educational_content_providers, public.educational_contents, public.educational_content_localizations, public.educational_lessons, public.educational_lesson_localizations, public.user_content_progress, public.user_content_bookmarks, public.educational_content_reviews TO service_role;
ALTER TABLE public.educational_content_reviews ALTER COLUMN status SET DEFAULT 'under_review';

DROP POLICY IF EXISTS education_active_categories_read ON public.educational_categories;
CREATE POLICY education_active_categories_read ON public.educational_categories FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS education_active_category_localizations_read ON public.educational_category_localizations;
CREATE POLICY education_active_category_localizations_read ON public.educational_category_localizations FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.educational_categories c WHERE c.id = category_id AND c.is_active = true));
DROP POLICY IF EXISTS education_published_providers_read ON public.educational_content_providers;
CREATE POLICY education_published_providers_read ON public.educational_content_providers FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.educational_contents ec WHERE ec.provider_id = id AND ec.status = 'published'));
DROP POLICY IF EXISTS education_published_content_read ON public.educational_contents;
CREATE POLICY education_published_content_read ON public.educational_contents FOR SELECT TO anon, authenticated USING (status = 'published');
DROP POLICY IF EXISTS education_published_content_localizations_read ON public.educational_content_localizations;
CREATE POLICY education_published_content_localizations_read ON public.educational_content_localizations FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.educational_contents ec WHERE ec.id = content_id AND ec.status = 'published'));
DROP POLICY IF EXISTS education_published_lessons_read ON public.educational_lessons;
CREATE POLICY education_published_lessons_read ON public.educational_lessons FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.educational_contents ec WHERE ec.id = content_id AND ec.status = 'published'));
DROP POLICY IF EXISTS education_published_lesson_localizations_read ON public.educational_lesson_localizations;
CREATE POLICY education_published_lesson_localizations_read ON public.educational_lesson_localizations FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.educational_lessons l JOIN public.educational_contents ec ON ec.id = l.content_id WHERE l.id = lesson_id AND ec.status = 'published'));

DROP POLICY IF EXISTS education_progress_select_own ON public.user_content_progress;
CREATE POLICY education_progress_select_own ON public.user_content_progress FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS education_progress_insert_own ON public.user_content_progress;
CREATE POLICY education_progress_insert_own ON public.user_content_progress FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.educational_contents ec WHERE ec.id = content_id AND ec.status = 'published') AND (lesson_id IS NULL OR EXISTS (SELECT 1 FROM public.educational_lessons l WHERE l.id = lesson_id AND l.content_id = content_id)));
DROP POLICY IF EXISTS education_progress_update_own ON public.user_content_progress;
CREATE POLICY education_progress_update_own ON public.user_content_progress FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.educational_contents ec WHERE ec.id = content_id AND ec.status = 'published') AND (lesson_id IS NULL OR EXISTS (SELECT 1 FROM public.educational_lessons l WHERE l.id = lesson_id AND l.content_id = content_id)));
DROP POLICY IF EXISTS education_progress_delete_own ON public.user_content_progress;
CREATE POLICY education_progress_delete_own ON public.user_content_progress FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS education_bookmarks_select_own ON public.user_content_bookmarks;
CREATE POLICY education_bookmarks_select_own ON public.user_content_bookmarks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS education_bookmarks_insert_own ON public.user_content_bookmarks;
CREATE POLICY education_bookmarks_insert_own ON public.user_content_bookmarks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.educational_contents ec WHERE ec.id = content_id AND ec.status = 'published'));
DROP POLICY IF EXISTS education_bookmarks_delete_own ON public.user_content_bookmarks;
CREATE POLICY education_bookmarks_delete_own ON public.user_content_bookmarks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS education_reviews_read_visible_or_own ON public.educational_content_reviews;
CREATE POLICY education_reviews_read_visible_or_own ON public.educational_content_reviews FOR SELECT TO anon, authenticated USING ((status = 'visible' AND EXISTS (SELECT 1 FROM public.educational_contents ec WHERE ec.id = content_id AND ec.status = 'published')) OR ((SELECT auth.uid()) IS NOT NULL AND status = 'under_review' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid()))));
DROP POLICY IF EXISTS education_reviews_insert_own_pending ON public.educational_content_reviews;
CREATE POLICY education_reviews_insert_own_pending ON public.educational_content_reviews FOR INSERT TO authenticated WITH CHECK (status = 'under_review' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.educational_contents ec WHERE ec.id = content_id AND ec.status = 'published'));
DROP POLICY IF EXISTS education_reviews_update_own_pending ON public.educational_content_reviews;
CREATE POLICY education_reviews_update_own_pending ON public.educational_content_reviews FOR UPDATE TO authenticated USING (status = 'under_review' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid()))) WITH CHECK (status = 'under_review' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.educational_contents ec WHERE ec.id = content_id AND ec.status = 'published'));
DROP POLICY IF EXISTS education_reviews_delete_own_pending ON public.educational_content_reviews;
CREATE POLICY education_reviews_delete_own_pending ON public.educational_content_reviews FOR DELETE TO authenticated USING (status = 'under_review' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = (SELECT auth.uid())));
COMMIT;
