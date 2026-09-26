-- ENUMS
CREATE TYPE public.listing_status AS ENUM ('AVAILABLE','RESERVED','SOLD');
CREATE TYPE public.listing_condition AS ENUM ('NEW','LIKE_NEW','GOOD','FAIR');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL DEFAULT 'Student',
  email text,
  image text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- LISTINGS
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  category text NOT NULL,
  condition public.listing_condition NOT NULL DEFAULT 'GOOD',
  status public.listing_status NOT NULL DEFAULT 'AVAILABLE',
  location text NOT NULL DEFAULT '',
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listings_seller_idx ON public.listings(seller_id);
CREATE INDEX listings_category_idx ON public.listings(category);
CREATE INDEX listings_created_idx ON public.listings(created_at DESC);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listings are viewable by everyone" ON public.listings FOR SELECT USING (true);
CREATE POLICY "Users can create own listings" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can update own listings" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can delete own listings" ON public.listings FOR DELETE TO authenticated USING (auth.uid() = seller_id);

-- LISTING IMAGES
CREATE TABLE public.listing_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url text NOT NULL,
  public_id text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_images_listing_idx ON public.listing_images(listing_id);
GRANT SELECT ON public.listing_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_images TO authenticated;
GRANT ALL ON public.listing_images TO service_role;
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listing images are viewable by everyone" ON public.listing_images FOR SELECT USING (true);
CREATE POLICY "Owners manage listing images" ON public.listing_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));

-- FAVORITES
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);
CREATE INDEX favorites_user_idx ON public.favorites(user_id);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own favorites" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own favorites" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CONVERSATIONS
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id, seller_id)
);
CREATE INDEX conversations_buyer_idx ON public.conversations(buyer_id);
CREATE INDEX conversations_seller_idx ON public.conversations(seller_id);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyers start conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id AND buyer_id <> seller_id);
CREATE POLICY "Participants touch conversations" ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id) WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
);
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER listings_touch BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- profile auto-creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, image)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1), 'Student'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SYNTHETIC DEMO DATA (fictional students only)
INSERT INTO public.profiles (id, name, email, bio) VALUES
  ('11111111-1111-4111-8111-111111111111','Alex Morgan','alex.morgan@demo.campuscart.test','Junior · moving off campus, selling dorm gear'),
  ('22222222-2222-4222-8222-222222222222','Jordan Lee','jordan.lee@demo.campuscart.test','Sophomore · usually replies in an hour'),
  ('33333333-3333-4333-8333-333333333333','Sam Patel','sam.patel@demo.campuscart.test','Senior · tech and textbooks'),
  ('44444444-4444-4444-8444-444444444444','Taylor Kim','taylor.kim@demo.campuscart.test','Grad student · kitchen and home items');

INSERT INTO public.listings (id, title, description, price, category, condition, status, location, seller_id, created_at) VALUES
  ('aaaa0001-0000-4000-8000-000000000001','BEKANT sit/stand desk','Bought it freshman year, moving off campus now. Motor works perfectly, surface has a couple of light marks from a laptop stand. Pickup only.',60,'Furniture','LIKE_NEW','AVAILABLE','Maple Commons, Rm 214','11111111-1111-4111-8111-111111111111', now() - interval '2 days'),
  ('aaaa0001-0000-4000-8000-000000000002','Mini fridge, 3.2 cu ft','Compact fridge with a small freezer shelf. Runs quiet, cleaned and defrosted. Great for a dorm room.',45,'Kitchen','GOOD','RESERVED','North Quad, Bldg C','22222222-2222-4222-8222-222222222222', now() - interval '5 days'),
  ('aaaa0001-0000-4000-8000-000000000003','Calculus, Early Transcendentals 9e','Used for Calc I and II. Some highlighting in the first few chapters, binding is solid.',22,'Textbooks','GOOD','AVAILABLE','Lamport Library','33333333-3333-4333-8333-333333333333', now() - interval '1 day'),
  ('aaaa0001-0000-4000-8000-000000000004','Compact mechanical keyboard','75% hot-swap board with cream keycaps. Typed on for one semester, comes with cable.',85,'Electronics','LIKE_NEW','SOLD','West Village, Apt 3B','33333333-3333-4333-8333-333333333333', now() - interval '6 days'),
  ('aaaa0001-0000-4000-8000-000000000005','Commuter bike, 21-speed','Reliable campus bike, new brake pads last month. Lock included.',130,'Sports','GOOD','AVAILABLE','East Quad bike racks','22222222-2222-4222-8222-222222222222', now() - interval '3 days'),
  ('aaaa0001-0000-4000-8000-000000000006','LED desk lamp with USB port','Adjustable arm, three brightness levels, built-in USB charging port.',15,'School Supplies','LIKE_NEW','AVAILABLE','Maple Commons, Rm 214','11111111-1111-4111-8111-111111111111', now() - interval '8 hours'),
  ('aaaa0001-0000-4000-8000-000000000007','Air fryer, 4 qt','Used a handful of times. Basket is dishwasher safe and included.',35,'Kitchen','LIKE_NEW','AVAILABLE','Riverside Apts, 12A','44444444-4444-4444-8444-444444444444', now() - interval '4 days'),
  ('aaaa0001-0000-4000-8000-000000000008','Everyday backpack, 25L','Padded laptop sleeve fits a 15-inch laptop. One small scuff on the base.',28,'Clothing','GOOD','AVAILABLE','Student Union','44444444-4444-4444-8444-444444444444', now() - interval '12 hours');

INSERT INTO public.listing_images (listing_id, url, position) VALUES
  ('aaaa0001-0000-4000-8000-000000000001','/images/desk.jpg',0),
  ('aaaa0001-0000-4000-8000-000000000002','/images/fridge.jpg',0),
  ('aaaa0001-0000-4000-8000-000000000003','/images/textbook.jpg',0),
  ('aaaa0001-0000-4000-8000-000000000004','/images/keyboard.jpg',0),
  ('aaaa0001-0000-4000-8000-000000000005','/images/bike.jpg',0),
  ('aaaa0001-0000-4000-8000-000000000006','/images/lamp.jpg',0),
  ('aaaa0001-0000-4000-8000-000000000007','/images/airfryer.jpg',0),
  ('aaaa0001-0000-4000-8000-000000000008','/images/backpack.jpg',0);

INSERT INTO public.conversations (id, listing_id, buyer_id, seller_id) VALUES
  ('bbbb0001-0000-4000-8000-000000000001','aaaa0001-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
INSERT INTO public.messages (conversation_id, sender_id, content, created_at) VALUES
  ('bbbb0001-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Hi! Is the desk still available?', now() - interval '20 hours'),
  ('bbbb0001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Yes it is — I can meet at Maple Commons any evening this week.', now() - interval '19 hours');

INSERT INTO public.favorites (user_id, listing_id) VALUES
  ('22222222-2222-4222-8222-222222222222','aaaa0001-0000-4000-8000-000000000003'),
  ('33333333-3333-4333-8333-333333333333','aaaa0001-0000-4000-8000-000000000001');
