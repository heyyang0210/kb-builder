---
title: "Oracle EXECUTE IMMEDIATE详解"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
author: "YashanDB知识库生成器"
last_verified: "2026-07-02"
related_kp_ids: ["P4-04-02"]
tags: ["Oracle", "EXECUTE IMMEDIATE", "动态SQL", "绑定变量", "USING", "INTO"]
---

# Oracle EXECUTE IMMEDIATE详解

## 一、概述

### 1.1 一句话定义

EXECUTE IMMEDIATE是Oracle PL/SQL中执行动态SQL的简化语法，支持DDL、DML和SELECT语句的动态执行。
它在需要灵活SQL的场景中出现和使用，解决运行时构建SQL的问题。

### 1.2 为什么重要

- **不掌握的后果：** 无法实现灵活的动态SQL操作
- **掌握的价值：** 构建灵活的数据库应用

## 二、核心原理

### 2.1 基本语法

```sql
-- 语法
EXECUTE IMMEDIATE dynamic_sql_string
    [INTO {variable | record}]
    [USING [IN|OUT|IN OUT] bind_argument ...];
```

### 2.2 DDL操作

```sql
-- 创建表
BEGIN
    EXECUTE IMMEDIATE 'CREATE TABLE test_tbl (id NUMBER, name VARCHAR2(100))';
END;
/

-- 动态表名
DECLARE
    v_table VARCHAR2(30) := 'dynamic_test';
BEGIN
    EXECUTE IMMEDIATE 'CREATE TABLE ' || v_table || ' (id NUMBER)';
END;
/
```

### 2.3 DML操作

```sql
-- INSERT
DECLARE
    v_sql VARCHAR2(1000);
BEGIN
    v_sql := 'INSERT INTO employees(id, name) VALUES(:1, :2)';
    EXECUTE IMMEDIATE v_sql USING 1, 'John';
END;
/

-- UPDATE
DECLARE
    v_sql VARCHAR2(1000);
    v_count NUMBER;
BEGIN
    v_sql := 'UPDATE employees SET salary = :1 WHERE department_id = :2';
    EXECUTE IMMEDIATE v_sql USING 50000, 10;
    v_count := SQL%ROWCOUNT;
    DBMS_OUTPUT.PUT_LINE('Updated: ' || v_count);
END;
/

-- DELETE
BEGIN
    EXECUTE IMMEDIATE 'DELETE FROM employees WHERE id = :1' USING 100;
END;
/
```

### 2.4 SELECT操作

```sql
-- 单行查询
DECLARE
    v_sql VARCHAR2(1000);
    v_name VARCHAR2(100);
    v_salary NUMBER;
BEGIN
    v_sql := 'SELECT name, salary FROM employees WHERE id = :1';
    EXECUTE IMMEDIATE v_sql INTO v_name, v_salary USING 100;
    DBMS_OUTPUT.PUT_LINE(v_name || ': ' || v_salary);
END;
/

-- 多行查询（使用游标变量）
DECLARE
    v_sql VARCHAR2(1000);
    v_cur SYS_REFCURSOR;
    v_name VARCHAR2(100);
BEGIN
    v_sql := 'SELECT name FROM employees WHERE department_id = :1';
    OPEN v_cur FOR v_sql USING 10;
    LOOP
        FETCH v_cur INTO v_name;
        EXIT WHEN v_cur%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(v_name);
    END LOOP;
    CLOSE v_cur;
END;
/
```

### 2.5 批量操作

```sql
-- FORALL批量DML
DECLARE
    TYPE num_tab IS TABLE OF NUMBER;
    TYPE name_tab IS TABLE OF VARCHAR2(100);
    v_ids num_tab := num_tab(1, 2, 3);
    v_names name_tab := name_tab('A', 'B', 'C');
    v_sql VARCHAR2(1000);
BEGIN
    v_sql := 'INSERT INTO test_tbl VALUES(:1, :2)';
    FORALL i IN 1..v_ids.COUNT
        EXECUTE IMMEDIATE v_sql USING v_ids(i), v_names(i);
END;
/
```

### 2.6 RETURNING子句

```sql
DECLARE
    v_sql VARCHAR2(1000);
    v_id NUMBER;
    v_name VARCHAR2(100) := 'New Employee';
BEGIN
    v_sql := 'INSERT INTO employees(name) VALUES(:1) RETURNING id INTO :2';
    EXECUTE IMMEDIATE v_sql USING v_name RETURNING INTO v_id;
    DBMS_OUTPUT.PUT_LINE('New ID: ' || v_id);
END;
/
```

## 三、实战案例

### 3.1 通用数据访问函数

```sql
CREATE OR REPLACE FUNCTION get_count(
    p_table VARCHAR2,
    p_where VARCHAR2 DEFAULT NULL
) RETURN NUMBER AS
    v_sql VARCHAR2(1000);
    v_count NUMBER;
BEGIN
    v_sql := 'SELECT COUNT(*) FROM ' || 
             DBMS_ASSERT.SIMPLE_SQL_NAME(p_table);
    IF p_where IS NOT NULL THEN
        v_sql := v_sql || ' WHERE ' || p_where;
    END IF;
    
    EXECUTE IMMEDIATE v_sql INTO v_count;
    RETURN v_count;
END;
/
```

## 四、最佳实践

### 4.1 注意事项

| 要点 | 说明 |
|------|------|
| 绑定变量 | 防止SQL注入 |
| 输入验证 | DBMS_ASSERT |
| 异常处理 | 必须捕获 |
| 性能 | 避免频繁硬解析 |

## 五、常见错误

| 错误 | 问题 | 解决方法 |
|------|------|---------|
| ORA-00911 | 无效字符 | 检查SQL |
| ORA-01006 | 绑定变量不匹配 | 检查USING |
| ORA-01008 | 未绑定变量 | 提供所有绑定 |

## 六、总结速查

### 6.1 黄金法则

1. **绑定变量** - 安全第一
2. **输入验证** - 防止注入
3. **异常处理** - 必须捕获
4. **游标变量** - 多行查询

## 附录

### A. 官方参考

- [Oracle Database PL/SQL Language Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19c/lnpls/)

### B. 修订记录

| 日期 | 版本 | 修改内容 | 修改人 |
|------|------|---------|--------|
| 2026-07-02 | v1.0 | 初始版本 | YashanDB知识库生成器 |

## 七、高级用法

### 7.1 动态DDL操作

```sql
-- 动态创建表
CREATE OR REPLACE PROCEDURE create_dynamic_table(
    p_table_name VARCHAR2,
    p_columns VARCHAR2
) IS
    v_sql VARCHAR2(4000);
BEGIN
    v_sql := 'CREATE TABLE ' || p_table_name || ' (' || p_columns || ')';
    EXECUTE IMMEDIATE v_sql;
    DBMS_OUTPUT.PUT_LINE('Table ' || p_table_name || ' created successfully');
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE = -955 THEN  -- 表已存在
            DBMS_OUTPUT.PUT_LINE('Table already exists');
        ELSE
            RAISE;
        END IF;
END;
/

-- 动态修改表结构
CREATE OR REPLACE PROCEDURE add_column_if_not_exists(
    p_table_name VARCHAR2,
    p_column_name VARCHAR2,
    p_column_def VARCHAR2
) IS
    v_count NUMBER;
    v_sql VARCHAR2(4000);
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM user_tab_columns
    WHERE table_name = UPPER(p_table_name)
    AND column_name = UPPER(p_column_name);
    
    IF v_count = 0 THEN
        v_sql := 'ALTER TABLE ' || p_table_name || ' ADD ' || p_column_name || ' ' || p_column_def;
        EXECUTE IMMEDIATE v_sql;
        DBMS_OUTPUT.PUT_LINE('Column added');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Column already exists');
    END IF;
END;
/

-- 动态创建索引
DECLARE
    v_sql VARCHAR2(4000);
BEGIN
    v_sql := 'CREATE INDEX idx_' || :table_name || '_' || :column_name || 
             ' ON ' || :table_name || '(' || :column_name || ')';
    EXECUTE IMMEDIATE v_sql;
END;
/
```

### 7.2 动态查询与批量操作

```sql
-- 动态SELECT INTO（单行）
CREATE OR REPLACE FUNCTION get_column_value(
    p_table_name VARCHAR2,
    p_column_name VARCHAR2,
    p_where_col VARCHAR2,
    p_where_val VARCHAR2
) RETURN VARCHAR2 IS
    v_result VARCHAR2(4000);
    v_sql VARCHAR2(4000);
BEGIN
    v_sql := 'SELECT ' || p_column_name || ' FROM ' || p_table_name ||
             ' WHERE ' || p_where_col || ' = :1';
    EXECUTE IMMEDIATE v_sql INTO v_result USING p_where_val;
    RETURN v_result;
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN NULL;
    WHEN TOO_MANY_ROWS THEN RAISE;
END;
/

-- 动态批量操作（使用BULK COLLECT）
CREATE OR REPLACE PROCEDURE dynamic_bulk_fetch(
    p_table_name VARCHAR2,
    p_condition VARCHAR2 DEFAULT NULL
) IS
    TYPE t_varray IS VARRAY(1000) OF VARCHAR2(4000);
    v_results t_varray;
    v_sql VARCHAR2(4000);
BEGIN
    v_sql := 'SELECT column_name FROM ' || p_table_name;
    IF p_condition IS NOT NULL THEN
        v_sql := v_sql || ' WHERE ' || p_condition;
    END IF;
    
    EXECUTE IMMEDIATE v_sql BULK COLLECT INTO v_results;
    
    FOR i IN 1 .. v_results.COUNT LOOP
        DBMS_OUTPUT.PUT_LINE(v_results(i));
    END LOOP;
END;
/

-- 动态FORALL批量操作
DECLARE
    TYPE t_ids IS TABLE OF NUMBER;
    v_ids t_ids := t_ids(1, 2, 3, 4, 5);
    v_sql VARCHAR2(4000);
BEGIN
    v_sql := 'UPDATE employees SET salary = salary * 1.1 WHERE employee_id = :1';
    FORALL i IN 1 .. v_ids.COUNT
        EXECUTE IMMEDIATE v_sql USING v_ids(i);
    DBMS_OUTPUT.PUT_LINE('Updated ' || SQL%ROWCOUNT || ' rows');
END;
/
```

### 7.3 动态返回结果集

```sql
-- 使用SYS_REFCURSOR返回动态查询结果
CREATE OR REPLACE FUNCTION dynamic_query(
    p_table_name VARCHAR2,
    p_columns VARCHAR2 DEFAULT '*',
    p_where VARCHAR2 DEFAULT NULL
) RETURN SYS_REFCURSOR IS
    v_cursor SYS_REFCURSOR;
    v_sql VARCHAR2(4000);
BEGIN
    v_sql := 'SELECT ' || p_columns || ' FROM ' || p_table_name;
    IF p_where IS NOT NULL THEN
        v_sql := v_sql || ' WHERE ' || p_where;
    END IF;
    
    OPEN v_cursor FOR v_sql;
    RETURN v_cursor;
END;
/

-- 调用示例
DECLARE
    v_cursor SYS_REFCURSOR;
    v_name VARCHAR2(100);
    v_salary NUMBER;
BEGIN
    v_cursor := dynamic_query('employees', 'ename, salary', 'salary > 5000');
    LOOP
        FETCH v_cursor INTO v_name, v_salary;
        EXIT WHEN v_cursor%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(v_name || ': ' || v_salary);
    END LOOP;
    CLOSE v_cursor;
END;
/
```

## 八、性能优化

### 8.1 执行计划与缓存

```sql
-- EXECUTE IMMEDIATE每次都进行硬解析
-- 优化方案：使用绑定变量减少解析开销

-- 不推荐：字符串拼接（每次硬解析）
DECLARE
    v_name VARCHAR2(100);
BEGIN
    FOR i IN 1 .. 1000 LOOP
        EXECUTE IMMEDIATE 'SELECT ename FROM emp WHERE empno = ' || i INTO v_name;
    END LOOP;
END;
/

-- 推荐：绑定变量（软解析）
DECLARE
    v_name VARCHAR2(100);
BEGIN
    FOR i IN 1 .. 1000 LOOP
        EXECUTE IMMEDIATE 'SELECT ename FROM emp WHERE empno = :1' INTO v_name USING i;
    END LOOP;
END;
/

-- 查看动态SQL的解析统计
SELECT sql_text, executions, parse_calls
FROM v$sql
WHERE sql_text LIKE '%EXECUTE IMMEDIATE%'
ORDER BY parse_calls DESC;
```

### 8.2 安全性最佳实践

```sql
-- 1. 始终使用绑定变量
-- 错误：EXECUTE IMMEDIATE 'SELECT * FROM t WHERE id = ' || p_id;
-- 正确：EXECUTE IMMEDIATE 'SELECT * FROM t WHERE id = :1' USING p_id;

-- 2. 验证输入
CREATE OR REPLACE FUNCTION safe_execute(p_input VARCHAR2) RETURN VARCHAR2 IS
    v_sanitized VARCHAR2(4000);
BEGIN
    -- 移除危险字符
    v_sanitized := REGEXP_REPLACE(p_input, '[;''"--]', '');
    -- 长度限制
    v_sanitized := SUBSTR(v_sanitized, 1, 100);
    RETURN v_sanitized;
END;
/

-- 3. 使用白名单验证表名和列名
CREATE OR REPLACE PROCEDURE safe_dynamic_sql(
    p_table VARCHAR2, p_column VARCHAR2
) IS
    v_count NUMBER;
BEGIN
    -- 验证表名是否在白名单中
    SELECT COUNT(*) INTO v_count
    FROM user_tables WHERE table_name = UPPER(p_table);
    
    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'Invalid table name');
    END IF;
    
    -- 验证列名
    SELECT COUNT(*) INTO v_count
    FROM user_tab_columns
    WHERE table_name = UPPER(p_table) AND column_name = UPPER(p_column);
    
    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20002, 'Invalid column name');
    END IF;
    
    EXECUTE IMMEDIATE 'SELECT ' || p_column || ' FROM ' || p_table;
END;
/
```

## 九、常见错误与排查

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| ORA-00911 | 无效字符 | 检查SQL语句末尾不要加分号 |
| ORA-00904 | 无效列名 | 检查动态列名 |
| ORA-01008 | 绑定变量未绑定 | 所有绑定变量必须USING |
| ORA-06550 | PL/SQL语法错误 | 检查BEGIN/END块 |
| ORA-00942 | 表不存在 | 检查动态表名 |
| ORA-01722 | 无效数字 | 类型转换错误 |

## 十、与DBMS_SQL对比

| 特性 | EXECUTE IMMEDIATE | DBMS_SQL |
|------|-------------------|----------|
| 语法 | 简单 | 复杂 |
| 功能 | 基本动态SQL | 完整动态SQL |
| 列数未知 | 不支持 | 支持（DESCRIBE） |
| 性能 | 略快 | 略慢 |
| 推荐场景 | 大多数场景 | 需要动态列定义 |

## 十一、命令与视图汇总

| 命令/视图 | 用途 |
|-----------|------|
| `EXECUTE IMMEDIATE` | 执行动态SQL |
| `USING` | 绑定变量 |
| `INTO` | 接收返回值 |
| `RETURNING INTO` | 接收DML返回值 |
| `DBMS_SQL` | 高级动态SQL包 |
| `v$sql` | 查看SQL缓存 |

## 十二、总结速查

| 操作 | 语法要点 |
|------|---------|
| DDL | 直接执行，不要分号 |
| DML | USING绑定变量 |
| SELECT单行 | INTO接收 |
| SELECT多行 | 返回SYS_REFCURSOR |
| 安全 | 始终使用绑定变量 |
