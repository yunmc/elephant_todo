-- 记账图表测试数据
-- 使用前请确保已有一个 user_id=1 的用户（或替换为实际 user_id）
-- 执行方式: mysql -u root -p elephant_todo < scripts/seed-finance-charts.sql

SET @uid = 1;

-- ===== 1. 创建支出分类 =====
INSERT IGNORE INTO finance_categories (user_id, name, icon, type, sort_order) VALUES
(@uid, '餐饮', '🍴', 'expense', 1),
(@uid, '交通', '🚗', 'expense', 2),
(@uid, '购物', '🛒', 'expense', 3),
(@uid, '房租', '🏠', 'expense', 4),
(@uid, '娱乐', '🎮', 'expense', 5),
(@uid, '医疗', '🏥', 'expense', 6),
(@uid, '教育', '🎓', 'expense', 7);

-- ===== 2. 创建收入分类 =====
INSERT IGNORE INTO finance_categories (user_id, name, icon, type, sort_order) VALUES
(@uid, '工资', '💵', 'income', 1),
(@uid, '奖金', '🏆', 'income', 2),
(@uid, '兼职', '💼', 'income', 3),
(@uid, '理财', '📈', 'income', 4);

-- ===== 3. 获取分类 ID =====
SET @c_food    = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='餐饮' AND type='expense' LIMIT 1);
SET @c_traffic = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='交通' AND type='expense' LIMIT 1);
SET @c_shop    = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='购物' AND type='expense' LIMIT 1);
SET @c_rent    = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='房租' AND type='expense' LIMIT 1);
SET @c_fun     = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='娱乐' AND type='expense' LIMIT 1);
SET @c_med     = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='医疗' AND type='expense' LIMIT 1);
SET @c_edu     = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='教育' AND type='expense' LIMIT 1);

SET @i_salary  = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='工资' AND type='income' LIMIT 1);
SET @i_bonus   = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='奖金' AND type='income' LIMIT 1);
SET @i_part    = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='兼职' AND type='income' LIMIT 1);
SET @i_invest  = (SELECT id FROM finance_categories WHERE user_id=@uid AND name='理财' AND type='income' LIMIT 1);

-- ===== 4. 本月（2026-03）支出记录 =====
INSERT INTO finance_records (user_id, category_id, type, amount, note, record_date) VALUES
(@uid, @c_food,    'expense', 35.00,  '早餐+午餐',      '2026-03-01'),
(@uid, @c_traffic, 'expense', 15.00,  '地铁通勤',        '2026-03-01'),
(@uid, @c_food,    'expense', 68.50,  '同事聚餐',        '2026-03-02'),
(@uid, @c_shop,    'expense', 299.00, '买衣服',          '2026-03-03'),
(@uid, @c_food,    'expense', 42.00,  '外卖',            '2026-03-04'),
(@uid, @c_fun,     'expense', 128.00, '电影+爆米花',     '2026-03-05'),
(@uid, @c_food,    'expense', 55.00,  '火锅',            '2026-03-06'),
(@uid, @c_traffic, 'expense', 25.00,  '打车',            '2026-03-07'),
(@uid, @c_rent,    'expense', 3500.00,'三月房租',         '2026-03-07'),
(@uid, @c_food,    'expense', 38.00,  '午餐+饮料',       '2026-03-08'),
(@uid, @c_edu,     'expense', 199.00, '线上课程',        '2026-03-09'),
(@uid, @c_med,     'expense', 85.00,  '买药',            '2026-03-10'),
(@uid, @c_food,    'expense', 46.00,  '日料',            '2026-03-11'),
(@uid, @c_shop,    'expense', 159.00, '日用品补货',      '2026-03-12'),
(@uid, @c_food,    'expense', 32.00,  '早餐奶茶',        '2026-03-12');

-- ===== 5. 本月（2026-03）收入记录 =====
INSERT INTO finance_records (user_id, category_id, type, amount, note, record_date) VALUES
(@uid, @i_salary, 'income', 12000.00, '3月工资',         '2026-03-05'),
(@uid, @i_part,   'income', 800.00,   '周末兼职',        '2026-03-08'),
(@uid, @i_invest, 'income', 156.30,   '基金收益',        '2026-03-10');

-- ===== 6. 前5个月历史数据（用于趋势图） =====

-- 2025-10
INSERT INTO finance_records (user_id, category_id, type, amount, note, record_date) VALUES
(@uid, @i_salary, 'income', 11000.00, '10月工资',       '2025-10-05'),
(@uid, @i_invest, 'income', 120.00,   '基金收益',       '2025-10-15'),
(@uid, @c_food,   'expense', 1200.00, '10月餐饮汇总',   '2025-10-15'),
(@uid, @c_rent,   'expense', 3500.00, '10月房租',       '2025-10-07'),
(@uid, @c_shop,   'expense', 450.00,  '10月购物',       '2025-10-20'),
(@uid, @c_traffic,'expense', 280.00,  '10月交通',       '2025-10-25'),
(@uid, @c_fun,    'expense', 200.00,  '10月娱乐',       '2025-10-28');

-- 2025-11
INSERT INTO finance_records (user_id, category_id, type, amount, note, record_date) VALUES
(@uid, @i_salary, 'income', 11000.00, '11月工资',       '2025-11-05'),
(@uid, @i_bonus,  'income', 2000.00,  '季度奖金',       '2025-11-20'),
(@uid, @i_invest, 'income', 98.50,    '基金收益',       '2025-11-15'),
(@uid, @c_food,   'expense', 1350.00, '11月餐饮汇总',   '2025-11-15'),
(@uid, @c_rent,   'expense', 3500.00, '11月房租',       '2025-11-07'),
(@uid, @c_shop,   'expense', 1200.00, '双十一购物',     '2025-11-11'),
(@uid, @c_traffic,'expense', 300.00,  '11月交通',       '2025-11-25'),
(@uid, @c_edu,    'expense', 399.00,  '课程续费',       '2025-11-18');

-- 2025-12
INSERT INTO finance_records (user_id, category_id, type, amount, note, record_date) VALUES
(@uid, @i_salary, 'income', 11000.00, '12月工资',       '2025-12-05'),
(@uid, @i_bonus,  'income', 5000.00,  '年终奖',         '2025-12-25'),
(@uid, @i_invest, 'income', 210.00,   '基金收益',       '2025-12-15'),
(@uid, @c_food,   'expense', 1500.00, '12月餐饮汇总',   '2025-12-15'),
(@uid, @c_rent,   'expense', 3500.00, '12月房租',       '2025-12-07'),
(@uid, @c_shop,   'expense', 800.00,  '圣诞礼物',       '2025-12-24'),
(@uid, @c_fun,    'expense', 350.00,  '跨年聚会',       '2025-12-31'),
(@uid, @c_traffic,'expense', 260.00,  '12月交通',       '2025-12-20');

-- 2026-01
INSERT INTO finance_records (user_id, category_id, type, amount, note, record_date) VALUES
(@uid, @i_salary, 'income', 12000.00, '1月工资',        '2026-01-05'),
(@uid, @i_invest, 'income', 180.00,   '基金收益',       '2026-01-15'),
(@uid, @c_food,   'expense', 1800.00, '春节餐饮',       '2026-01-15'),
(@uid, @c_rent,   'expense', 3500.00, '1月房租',        '2026-01-07'),
(@uid, @c_shop,   'expense', 600.00,  '年货',           '2026-01-20'),
(@uid, @c_traffic,'expense', 500.00,  '春运车票',       '2026-01-22'),
(@uid, @c_fun,    'expense', 150.00,  '春节娱乐',       '2026-01-28');

-- 2026-02
INSERT INTO finance_records (user_id, category_id, type, amount, note, record_date) VALUES
(@uid, @i_salary, 'income', 12000.00, '2月工资',        '2026-02-05'),
(@uid, @i_part,   'income', 1500.00,  '接私活',         '2026-02-20'),
(@uid, @i_invest, 'income', 145.00,   '基金收益',       '2026-02-15'),
(@uid, @c_food,   'expense', 1100.00, '2月餐饮汇总',    '2026-02-15'),
(@uid, @c_rent,   'expense', 3500.00, '2月房租',        '2026-02-07'),
(@uid, @c_shop,   'expense', 350.00,  '2月购物',        '2026-02-14'),
(@uid, @c_traffic,'expense', 240.00,  '2月交通',        '2026-02-25'),
(@uid, @c_med,    'expense', 180.00,  '体检',           '2026-02-18');

SELECT '✅ 记账图表测试数据插入完成！' AS result;
SELECT
  DATE_FORMAT(record_date, '%Y-%m') AS month,
  type,
  COUNT(*) AS count,
  SUM(amount) AS total
FROM finance_records
WHERE user_id = @uid
GROUP BY month, type
ORDER BY month, type;
