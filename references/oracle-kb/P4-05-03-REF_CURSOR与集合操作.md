---
title: "Oracle REF CURSOR与集合操作"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
author: "YashanDB知识库生成器"
last_verified: "2026-07-02"
related_kp_ids: ["P4-05-03"]
tags: ["Oracle", "REF CURSOR", "SYS_REFCURSOR", "游标变量", "管道函数", "集合操作"]
---

# Oracle REF CURSOR与集合操作

## 一、概述

### 1.1 一句话定义

REF CURSOR是Oracle中指向查询结果集的游标变量，可以在运行时动态关联不同的查询，并通过管道函数返回集合结果。
它在需要灵活游标操作的场景中出现和使用，解决动态返回结果集的问题。

## 二、核心原理

### 2.1 REF CURSOR类型

```sql
-- 弱类型（不指定返回类型）
TYPE ref_cur_type IS REF CURSOR;

-- 强类型（指定返回类型）
TYPE emp_cur_type IS REF CURSOR RETURN employees%ROWTYPE;

-- 系统预定义
-- SYS_REFCURSOR 是弱类型
```

### 2.2 使用SYS_REFCURSOR

```sql
DECLARE
    v_cur SYS_REFCURSOR;
    v_id NUMBER;
    v_name VARCHAR2(100);
BEGIN
    -- 动态关联查询
    OPEN v_cur FOR SELECT employee_id, name FROM employees WHERE department_id = 10;
    
    LOOP
        FETCH v_cur INTO v_id, v_name;
        EXIT WHEN v_cur%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(v_id || ': ' || v_name);
    END LOOP;
    
    CLOSE v_cur;
    
    -- 可以重新关联不同查询
    OPEN v_cur FOR SELECT department_id, department_name FROM departments;
    -- ... 处理
    CLOSE v_cur;
END;
/
```

### 2.3 函数返回游标

```sql
-- 返回游标的函数
CREATE OR REPLACE FUNCTION get_employees(
    p_dept_id IN NUMBER DEFAULT NULL
) RETURN SYS_REFCURSOR AS
    v_cur SYS_REFCURSOR;
BEGIN
    IF p_dept_id IS NOT NULL THEN
        OPEN v_cur FOR 
            SELECT employee_id, name, salary 
            FROM employees 
            WHERE department_id = p_dept_id;
    ELSE
        OPEN v_cur FOR 
            SELECT employee_id, name, salary 
            FROM employees;
    END IF;
    
    RETURN v_cur;
END;
/

-- 调用
DECLARE
    v_cur SYS_REFCURSOR;
    v_rec employees%ROWTYPE;
BEGIN
    v_cur := get_employees(10);
    LOOP
        FETCH v_cur INTO v_rec;
        EXIT WHEN v_cur%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(v_rec.name);
    END LOOP;
    CLOSE v_cur;
END;
/
```

### 2.4 管道函数（Pipelined Function）

```sql
-- 创建集合类型
CREATE OR REPLACE TYPE emp_obj AS OBJECT (
    employee_id NUMBER,
    name VARCHAR2(100),
    salary NUMBER
);
/

CREATE OR REPLACE TYPE emp_table AS TABLE OF emp_obj;
/

-- 管道函数
CREATE OR REPLACE FUNCTION get_high_earners(
    p_min_salary IN NUMBER
) RETURN emp_table PIPELINED AS
BEGIN
    FOR rec IN (SELECT employee_id, name, salary 
                FROM employees 
                WHERE salary > p_min_salary) LOOP
        PIPE ROW(emp_obj(rec.employee_id, rec.name, rec.salary));
    END LOOP;
    RETURN;
END;
/

-- 在SQL中使用
SELECT * FROM TABLE(get_high_earners(50000));
```

### 2.5 游标变量与集合

```sql
-- 游标变量结合集合类型
DECLARE
    TYPE emp_cur_type IS REF CURSOR;
    v_cur emp_cur_type;
    
    TYPE emp_tab IS TABLE OF employees%ROWTYPE;
    v_emps emp_tab;
BEGIN
    OPEN v_cur FOR SELECT * FROM employees WHERE department_id = 10;
    
    -- 批量提取到集合
    FETCH v_cur BULK COLLECT INTO v_emps;
    CLOSE v_cur;
    
    -- 处理集合
    FOR i IN 1..v_emps.COUNT LOOP
        DBMS_OUTPUT.PUT_LINE(v_emps(i).name);
    END LOOP;
END;
/
```

### 2.6 过程间传递游标

```sql
-- 过程1：打开游标
CREATE OR REPLACE PROCEDURE open_cursor(
    p_cur OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cur FOR SELECT * FROM employees;
END;
/

-- 过程2：处理游标
CREATE OR REPLACE PROCEDURE process_cursor(
    p_cur IN SYS_REFCURSOR
) AS
    v_rec employees%ROWTYPE;
BEGIN
    LOOP
        FETCH p_cur INTO v_rec;
        EXIT WHEN p_cur%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(v_rec.name);
    END LOOP;
    CLOSE p_cur;
END;
/

-- 组合使用
DECLARE
    v_cur SYS_REFCURSOR;
BEGIN
    open_cursor(v_cur);
    process_cursor(v_cur);
END;
/
```

## 三、实战案例

### 3.1 通用报表框架

```sql
CREATE OR REPLACE PACKAGE report_pkg AS
    FUNCTION get_report(p_type VARCHAR2) RETURN SYS_REFCURSOR;
END;
/

CREATE OR REPLACE PACKAGE BODY report_pkg AS
    FUNCTION get_report(p_type VARCHAR2) RETURN SYS_REFCURSOR AS
        v_cur SYS_REFCURSOR;
    BEGIN
        CASE p_type
            WHEN 'EMPLOYEES' THEN
                OPEN v_cur FOR SELECT * FROM employees;
            WHEN 'DEPARTMENTS' THEN
                OPEN v_cur FOR SELECT * FROM departments;
            ELSE
                OPEN v_cur FOR SELECT 'Invalid type' AS error FROM dual;
        END CASE;
        RETURN v_cur;
    END;
END;
/
```

## 四、最佳实践

### 4.1 注意事项

| 要点 | 说明 |
|------|------|
| 及时关闭 | 防止资源泄漏 |
| 管道函数 | 大数据集流式处理 |
| 类型安全 | 强类型更安全 |
| 异常处理 | 确保关闭游标 |

## 五、总结速查

### 5.1 黄金法则

1. **SYS_REFCURSOR** - 通用游标变量
2. **管道函数** - 流式返回集合
3. **及时关闭** - 防止资源泄漏
4. **BULK COLLECT** - 批量提取

## 附录

### A. 官方参考

- [Oracle Database PL/SQL Language Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19c/lnpls/)

### B. 修订记录

| 日期 | 版本 | 修改内容 | 修改人 |
|------|------|---------|--------|
| 2026-07-02 | v1.0 | 初始版本 | YashanDB知识库生成器 |

## 七、REF CURSOR高级用法

### 7.1 强类型与弱类型

```sql
-- 强类型REF CURSOR（编译时检查）
DECLARE
    TYPE emp_cursor_type IS REF CURSOR RETURN employees%ROWTYPE;
    v_cursor emp_cursor_type;
    v_emp employees%ROWTYPE;
BEGIN
    OPEN v_cursor FOR SELECT * FROM employees WHERE department_id = 10;
    LOOP
        FETCH v_cursor INTO v_emp;
        EXIT WHEN v_cursor%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(v_emp.employee_id || ': ' || v_emp.first_name);
    END LOOP;
    CLOSE v_cursor;
END;
/

-- 弱类型REF CURSOR（灵活但无编译检查）
DECLARE
    TYPE generic_cursor IS REF CURSOR;
    v_cursor generic_cursor;
BEGIN
    -- 可以查询任何表
    OPEN v_cursor FOR 'SELECT * FROM employees';
    -- 或
    OPEN v_cursor FOR SELECT department_name FROM departments;
END;
/

-- SYS_REFCURSOR（Oracle内置弱类型）
CREATE OR REPLACE FUNCTION get_employees(p_dept_id NUMBER)
RETURN SYS_REFCURSOR IS
    v_cursor SYS_REFCURSOR;
BEGIN
    OPEN v_cursor FOR
        SELECT employee_id, first_name, last_name, salary
        FROM employees WHERE department_id = p_dept_id;
    RETURN v_cursor;
END;
/
```

### 7.2 REF CURSOR与集合结合

```sql
-- 使用BULK COLLECT将游标数据加载到集合
DECLARE
    TYPE emp_table_type IS TABLE OF employees%ROWTYPE;
    v_emp_table emp_table_type;
    v_cursor SYS_REFCURSOR;
BEGIN
    OPEN v_cursor FOR SELECT * FROM employees WHERE department_id = 10;
    
    FETCH v_cursor BULK COLLECT INTO v_emp_table;
    CLOSE v_cursor;
    
    -- 遍历集合
    FOR i IN 1 .. v_emp_table.COUNT LOOP
        DBMS_OUTPUT.PUT_LINE(v_emp_table(i).first_name || ': ' || 
                            v_emp_table(i).salary);
    END LOOP;
    
    DBMS_OUTPUT.PUT_LINE('Total: ' || v_emp_table.COUNT || ' employees');
END;
/

-- 使用集合操作游标数据
DECLARE
    TYPE t_emp_ids IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
    TYPE t_emp_names IS TABLE OF VARCHAR2(100) INDEX BY PLS_INTEGER;
    v_ids t_emp_ids;
    v_names t_emp_names;
    v_cursor SYS_REFCURSOR;
BEGIN
    OPEN v_cursor FOR SELECT employee_id, first_name || ' ' || last_name
                      FROM employees WHERE ROWNUM <= 10;
    
    FETCH v_cursor BULK COLLECT INTO v_ids, v_names;
    CLOSE v_cursor;
    
    FOR i IN 1 .. v_ids.COUNT LOOP
        DBMS_OUTPUT.PUT_LINE(v_ids(i) || ': ' || v_names(i));
    END LOOP;
END;
/
```

### 7.3 管道函数与REF CURSOR

```sql
-- 创建管道函数处理REF CURSOR
CREATE OR REPLACE TYPE emp_rec_type AS OBJECT (
    emp_id NUMBER, emp_name VARCHAR2(100), salary NUMBER
);
/
CREATE OR REPLACE TYPE emp_table_type AS TABLE OF emp_rec_type;
/

CREATE OR REPLACE FUNCTION pipe_employees(p_cursor SYS_REFCURSOR)
RETURN emp_table_type PIPELINED IS
    v_rec emp_rec_type;
BEGIN
    LOOP
        FETCH p_cursor INTO v_rec.emp_id, v_rec.emp_name, v_rec.salary;
        EXIT WHEN p_cursor%NOTFOUND;
        PIPE ROW (v_rec);
    END LOOP;
    CLOSE p_cursor;
    RETURN;
END;
/

-- 使用管道函数
SELECT * FROM TABLE(
    pipe_employees(
        CURSOR(SELECT employee_id, first_name || ' ' || last_name, salary 
               FROM employees WHERE department_id = 10)
    )
);
```

## 八、集合操作高级技巧

### 8.1 集合运算

```sql
-- UNION（去重合并）
SELECT employee_id, first_name FROM employees WHERE department_id = 10
UNION
SELECT employee_id, first_name FROM employees WHERE salary > 10000;

-- UNION ALL（保留重复）
SELECT employee_id, first_name FROM employees WHERE department_id = 10
UNION ALL
SELECT employee_id, first_name FROM employees WHERE salary > 10000;

-- INTERSECT（交集）
SELECT employee_id FROM employees WHERE department_id = 10
INTERSECT
SELECT employee_id FROM employees WHERE salary > 10000;

-- MINUS（差集）
SELECT employee_id FROM employees WHERE department_id = 10
MINUS
SELECT employee_id FROM employees WHERE salary > 10000;
```

### 8.2 PL/SQL集合操作

```sql
-- 嵌套表的集合运算
DECLARE
    TYPE t_numbers IS TABLE OF NUMBER;
    v_set1 t_numbers := t_numbers(1, 2, 3, 4, 5);
    v_set2 t_numbers := t_numbers(3, 4, 5, 6, 7);
    v_result t_numbers;
BEGIN
    -- UNION（并集）
    v_result := v_set1 MULTISET UNION v_set2;
    
    -- UNION DISTINCT（去重并集）
    v_result := v_set1 MULTISET UNION DISTINCT v_set2;
    
    -- INTERSECT（交集）
    v_result := v_set1 MULTISET INTERSECT v_set2;
    
    -- EXCEPT（差集）
    v_result := v_set1 MULTISET EXCEPT v_set2;
    
    -- 集合比较
    IF v_set1 SUBMULTISET OF v_result THEN
        DBMS_OUTPUT.PUT_LINE('v_set1 is subset of result');
    END IF;
    
    IF v_set1 = v_set2 THEN
        DBMS_OUTPUT.PUT_LINE('Sets are equal');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Sets are different');
    END IF;
END;
/
```

## 九、性能优化

### 9.1 游标性能建议

| 建议 | 说明 |
|------|------|
| BULK COLLECT | 批量获取减少上下文切换 |
| LIMIT子句 | 控制内存使用 |
| 关闭游标 | 及时释放资源 |
| 避免嵌套游标 | 改用JOIN |
| FORALL | 批量DML操作 |

```sql
-- BULK COLLECT性能对比
-- 逐行获取（慢）
DECLARE
    CURSOR c IS SELECT * FROM employees;
    v_emp employees%ROWTYPE;
BEGIN
    OPEN c;
    LOOP
        FETCH c INTO v_emp;
        EXIT WHEN c%NOTFOUND;
        -- 处理
    END LOOP;
    CLOSE c;
END;
/

-- 批量获取（快）
DECLARE
    CURSOR c IS SELECT * FROM employees;
    TYPE t_emp IS TABLE OF employees%ROWTYPE;
    v_emps t_emp;
BEGIN
    OPEN c;
    FETCH c BULK COLLECT INTO v_emps;
    CLOSE c;
    
    FOR i IN 1 .. v_emps.COUNT LOOP
        -- 处理
    END LOOP;
END;
/

-- 大数据量分批获取
DECLARE
    CURSOR c IS SELECT * FROM big_table;
    TYPE t_data IS TABLE OF big_table%ROWTYPE;
    v_data t_data;
BEGIN
    OPEN c;
    LOOP
        FETCH c BULK COLLECT INTO v_data LIMIT 1000;
        EXIT WHEN v_data.COUNT = 0;
        -- 处理1000行
        FORALL i IN 1 .. v_data.COUNT
            UPDATE target_table SET col = v_data(i).col WHERE id = v_data(i).id;
    END LOOP;
    CLOSE c;
END;
/
```

## 十、常见错误与排查

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| ORA-01001 | 无效游标 | 检查游标是否已关闭 |
| ORA-01002 | 获取超出 | 检查%NOTFOUND |
| ORA-01000 | 游标过多 | 及时关闭游标 |
| ORA-00932 | 类型不一致 | 检查REF CURSOR类型 |
| ORA-01403 | 无数据 | 处理NO_DATA_FOUND |

## 十一、命令与视图汇总

| 命令/视图 | 用途 |
|-----------|------|
| `REF CURSOR` | 游标变量类型 |
| `SYS_REFCURSOR` | 内置游标类型 |
| `BULK COLLECT` | 批量获取 |
| `FORALL` | 批量DML |
| `MULTISET` | 集合运算 |
| `PIPELINED` | 管道函数 |

## 十二、总结速查

| 特性 | 用法 | 场景 |
|------|------|------|
| 强类型REF CURSOR | RETURN指定类型 | 类型安全 |
| 弱类型REF CURSOR | SYS_REFCURSOR | 灵活通用 |
| BULK COLLECT | 批量获取 | 性能优化 |
| 管道函数 | PIPELINED | 流式处理 |
| 集合运算 | MULTISET | 集合操作 |
