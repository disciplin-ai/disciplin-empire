insert into public.gyms
(name, city, country, primary_discipline, disciplines, style_tags, intensity_label, is_verified)
values
('Kuma Team', 'Dubai', 'UAE', 'MMA',
ARRAY['MMA','Wrestling','BJJ'],
ARRAY['pressure','scramble'],
'Hard',
true),

('Team Nogueira Dubai', 'Dubai', 'UAE', 'BJJ',
ARRAY['BJJ','NoGi'],
ARRAY['grappling','guard'],
'Moderate',
true),

('TK MMA & Fitness', 'Dubai', 'UAE', 'MMA',
ARRAY['MMA','Muay Thai','Boxing'],
ARRAY['striking','kickboxing'],
'Hard',
true);