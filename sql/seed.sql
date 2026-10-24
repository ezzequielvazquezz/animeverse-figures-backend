-- Datos de DEMOSTRACIÓN. Precios, stock y especificaciones son ficticios.
-- Las imágenes se registran aparte (ver tools/descargar-imagenes.mjs).

INSERT INTO franquicias (nombre, slug, descripcion, color_acento) VALUES
  ('Fullmetal Alchemist', 'fullmetal-alchemist', 'Hermanos, alquimia y el precio de la equivalencia.', '#C9302C'),
  ('Bleach', 'bleach', 'Shinigamis, espadas y el Seireitei en tu vitrina.', '#E8892B'),
  ('Slam Dunk', 'slam-dunk', 'El baloncesto de Shohoku, a escala de colección.', '#E2513A'),
  ('JoJo''s Bizarre Adventure', 'jojo', 'Poses imposibles y una herencia de generaciones.', '#8E5BD6');

INSERT INTO productos (franquicia_id, sku, slug, nombre, personaje, descripcion, precio, precio_oferta, stock, escala, altura_cm, material, destacado) VALUES
  ((SELECT id FROM franquicias WHERE slug='fullmetal-alchemist'), 'AVF-FMA-001', 'edward-elric', 'Edward Elric', 'Edward Elric', 'El Alquimista de Acero en plena transmutación. Figura de demostración para probar la tienda.', 129.99, NULL, 12, '1/7', 24.0, 'PVC y ABS', 1),
  ((SELECT id FROM franquicias WHERE slug='fullmetal-alchemist'), 'AVF-FMA-002', 'alphonse-elric', 'Alphonse Elric', 'Alphonse Elric', 'La armadura que guarda un alma. Pieza imponente pensada para vitrina.', 139.99, 119.99, 8, '1/7', 27.5, 'PVC y ABS', 0),
  ((SELECT id FROM franquicias WHERE slug='fullmetal-alchemist'), 'AVF-FMA-003', 'roy-mustang', 'Roy Mustang', 'Roy Mustang', 'El Alquimista de Fuego con el guante listo para el chasquido.', 149.99, NULL, 5, '1/7', 25.0, 'PVC y ABS', 1),
  ((SELECT id FROM franquicias WHERE slug='fullmetal-alchemist'), 'AVF-FMA-004', 'riza-hawkeye', 'Riza Hawkeye', 'Riza Hawkeye', 'Precisión y lealtad. Actualmente agotada: útil para probar el filtro de disponibilidad.', 134.99, NULL, 0, '1/7', 24.5, 'PVC y ABS', 0),
  ((SELECT id FROM franquicias WHERE slug='bleach'), 'AVF-BLE-001', 'ichigo-kurosaki', 'Ichigo Kurosaki', 'Ichigo Kurosaki', 'Shinigami sustituto con Zangetsu en alto.', 159.99, NULL, 10, '1/7', 26.0, 'PVC y ABS', 1),
  ((SELECT id FROM franquicias WHERE slug='bleach'), 'AVF-BLE-002', 'rukia-kuchiki', 'Rukia Kuchiki', 'Rukia Kuchiki', 'Sode no Shirayuki en una pose elegante y fría.', 144.99, 129.99, 7, '1/7', 23.0, 'PVC y ABS', 0),
  ((SELECT id FROM franquicias WHERE slug='bleach'), 'AVF-BLE-003', 'byakuya-kuchiki', 'Byakuya Kuchiki', 'Byakuya Kuchiki', 'El capitán del sexto escuadrón, impecable hasta en el último pliegue.', 164.99, NULL, 4, '1/7', 26.5, 'PVC y ABS', 1),
  ((SELECT id FROM franquicias WHERE slug='bleach'), 'AVF-BLE-004', 'toshiro-hitsugaya', 'Tōshirō Hitsugaya', 'Tōshirō Hitsugaya', 'El capitán prodigio con Hyōrinmaru y efecto de hielo en la base.', 149.99, NULL, 6, '1/7', 24.0, 'PVC y ABS', 0),
  ((SELECT id FROM franquicias WHERE slug='slam-dunk'), 'AVF-SLD-001', 'hanamichi-sakuragi', 'Hanamichi Sakuragi', 'Hanamichi Sakuragi', 'El genio autoproclamado en pleno rebote.', 119.99, NULL, 15, '1/8', 23.0, 'PVC y ABS', 1),
  ((SELECT id FROM franquicias WHERE slug='slam-dunk'), 'AVF-SLD-002', 'kaede-rukawa', 'Kaede Rukawa', 'Kaede Rukawa', 'Frío, veloz y concentrado en la canasta.', 119.99, 99.99, 9, '1/8', 23.5, 'PVC y ABS', 0),
  ((SELECT id FROM franquicias WHERE slug='slam-dunk'), 'AVF-SLD-003', 'takenori-akagi', 'Takenori Akagi', 'Takenori Akagi', 'El capitán y pilar de Shohoku bajo el aro.', 124.99, NULL, 3, '1/8', 25.0, 'PVC y ABS', 0),
  ((SELECT id FROM franquicias WHERE slug='slam-dunk'), 'AVF-SLD-004', 'ryota-miyagi', 'Ryota Miyagi', 'Ryota Miyagi', 'El base más rápido de la cancha, con balón en mano.', 114.99, NULL, 11, '1/8', 21.5, 'PVC y ABS', 0),
  ((SELECT id FROM franquicias WHERE slug='jojo'), 'AVF-JJB-001', 'jonathan-joestar', 'Jonathan Joestar', 'Jonathan Joestar', 'El caballero inglés de Hamon, con una pose heroica.', 154.99, NULL, 6, '1/7', 27.0, 'PVC y ABS', 0),
  ((SELECT id FROM franquicias WHERE slug='jojo'), 'AVF-JJB-002', 'joseph-joestar', 'Joseph Joestar', 'Joseph Joestar', 'Astuto, impredecible y siempre con una jugada preparada.', 154.99, 134.99, 5, '1/7', 26.5, 'PVC y ABS', 1),
  ((SELECT id FROM franquicias WHERE slug='jojo'), 'AVF-JJB-003', 'jotaro-kujo', 'Jotaro Kujo', 'Jotaro Kujo', 'Una de las poses más reconocibles del coleccionismo, lista para tu estante.', 169.99, NULL, 9, '1/7', 27.5, 'PVC y ABS', 1),
  ((SELECT id FROM franquicias WHERE slug='jojo'), 'AVF-JJB-004', 'dio-brando', 'Dio Brando', 'Dio Brando', 'El villano más carismático, con una base de escenario dramática.', 174.99, NULL, 2, '1/7', 28.0, 'PVC y ABS', 0);
