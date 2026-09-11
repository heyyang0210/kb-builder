Created by 赵育, last modified on 十一月 12, 2024

**目的：**    
  1.牵引TSE理解特性，熟悉特性的主要能力、规格、约束、应用场景等    
  2.牵引TSE在研发设计评审中能给出有效意见(如识别特性行为、规格、约束与友商的重大差异，关联能力缺漏)    
  3.给测试概要设计和测试详细设计做输入

# 1. 需求概述

  [https://pingcode.yasdb.com/ship/ideas/6716285f52495bd785c64b2d](https://pingcode.yasdb.com/ship/ideas/6716285f52495bd785c64b2d)    ?    
  #YASHAN-3389 IN BINARY SEARCH 规格增强

行存 in 条件值个数较多时，性能不佳

# 2. 友商的实现情况

*行存：Oracle*    
  *功能点、语法图、接口、主要规格/约束*

Expression lists can appear in comparison and membership conditions and in GROUP BY clauses of queries and subqueries. An expression lists in a comparision or membership condition is sometimes referred to as a row value constructor or row constructor。

Comparison and membership conditions appear in the conditions of WHERE clauses. They can contain either one or more comma-delimited expressions or one or more sets of expressions where each set contains one or more comma-delimited expressions. In the latter case (multiple sets of expressions):

- Each set is bounded by parentheses
- Each set must contain the same number of expressions
- The number of expressions in each set must match the number of expressions before the operator in the comparison condition or before the IN keyword in the membership condition.


A comma-delimited list of expressions can contain no more than 65,535 expressions. A comma-delimited list of sets of expressions can contain any number of sets, but each set can contain no more than 1000 expressions.

The following are some valid expression lists in conditions:

(10, 20, 40)     
  ('SCOTT', 'BLAKE', 'TAYLOR') ---表达式列表个数不超过 65535 个    
  ( ('Guy', 'Himuro', 'GHIMURO'),('Karen', 'Colmenares', 'KCOLMENA') ) --- 表达式列表集合不超过 1000 个

In the third example, the number of expressions in each set must equal the number of expressions in the first part of the condition. For example:

  


SELECT * FROM employees     
  WHERE (first_name, last_name, email) IN     
  (('Guy', 'Himuro', 'GHIMURO'),('Karen', 'Colmenares', 'KCOLMENA'))  ----条件个数和表达式列表个数相等，且每个表达式集合个数相等

  


In a simple GROUP BY clause, you can use either the upper or lower form of expression list:

SELECT department_id, MIN(salary) min, MAX(salary) max FROM employees    
  GROUP BY department_id, salary    
  ORDER BY department_id, min, max;

SELECT department_id, MIN(salary) min, MAX(salary) max FROM employees    
  GROUP BY (department_id, salary)    
  ORDER BY department_id, min, max;

In ROLLUP, CUBE, and GROUPING SETS clauses of GROUP BY clauses, you can combine individual expressions with sets of expressions in the same expression list. The following example shows several valid grouping sets expression lists in one SQL statement:

SELECT     
  prod_category, prod_subcategory, country_id, cust_city, count(*)    
  FROM products, sales, customers    
  WHERE sales.prod_id = products.prod_id     
  AND sales.cust_id=customers.cust_id     
  AND sales.time_id = '01-oct-00'    
  AND customers.cust_year_of_birth BETWEEN 1960 and 1970    
  GROUP BY GROUPING SETS     
  (    
  (prod_category, prod_subcategory, country_id, cust_city),    
  (prod_category, prod_subcategory, country_id),    
  (prod_category, prod_subcategory),    
  country_id    
  )    
  ORDER BY prod_category, prod_subcategory, country_id, cust_city;

mysql：in 的个数由配置项     [](https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_max_allowed_packet)     来确定

pg：只有使用方法，没有规格的说明

# 3. 示例

*友商的用法示例*

# 4. 参考文档

oracle:    [https://docs.oracle.com/cd/E11882_01/server.112/e41084/expressions015.htm#SQLRF52099](https://docs.oracle.com/cd/E11882_01/server.112/e41084/expressions015.htm#SQLRF52099)  

mysql:    [https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html#operator_in](https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html#operator_in)  

pg:    [https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-IN](https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-IN)  

# 5. 后续关注(可选)

*后续测试设计与执行过程中需跟友商做细化对比的内容*