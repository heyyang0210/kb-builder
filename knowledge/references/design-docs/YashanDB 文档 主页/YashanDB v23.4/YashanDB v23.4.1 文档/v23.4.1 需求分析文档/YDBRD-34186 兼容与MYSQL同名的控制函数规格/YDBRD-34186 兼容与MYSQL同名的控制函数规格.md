IR :   [https://pingcode.yasdb.com/pjm/items/670de7ace489dd0868f7a133? ](https://pingcode.yasdb.com/pjm/items/670de7ace489dd0868f7a133?)  #YDBRD-34185 【mysql兼容】兼容与MYSQL同名的控制函数规格

SR:   [https://pingcode.yasdb.com/pjm/items/670de7ad6544792659b37088? ](https://pingcode.yasdb.com/pjm/items/670de7ad6544792659b37088?)  #YDBRD-34186 开发任务：【mysql兼容】兼容与MYSQL同名的控制函数规格



#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#1-%E6%80%BB%E8%BF%B0)  

在原有的mysql框架之上，适配 case操作符、if 函数、nullif函数、ifnull函数。



#   [1.1 需求合理性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#11-%E9%9C%80%E6%B1%82%E5%90%88%E7%90%86%E6%80%A7%E5%88%86%E6%9E%90)  

  


##   [1.2 需求实现分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

### 1.2.1 case 操作符

语法规格

```
CASE value 
  WHEN compare_value THEN result 
  [WHEN compare_value THEN result ...] 
  [ELSE result] 
END

CASE WHEN condition THEN result 
    [WHEN condition THEN result ...] 
    [ELSE result] 
END
```

示例

```
SELECT CASE 1 WHEN 1 THEN 'one' 
             WHEN 2 THEN 'two' 
             ELSE 'more' 
       END;

SELECT CASE WHEN 1>0 THEN 'true' 
            ELSE 'false' 
       END;

SELECT CASE BINARY 'B' WHEN 'a' THEN 1 
                       WHEN 'b' THEN 2 
       END;
```



说明 

The first CASE syntax returns the result for the first value=compare_value comparison that is true.  
The second syntax returns the result for the first condition that is true. If no comparison or condition is true, the result after ELSE is returned, or NULL if there is no ELSE part.



和 case statement区别

The syntax of the CASE operator described here differs slightly from that of the SQL CASE statement described in Section 13.6.5.1, “CASE Statement”, for use

inside stored programs. The CASE statement cannot have an ELSE NULL clause, and it is terminated with  ** END CASE instead of END**  .

示例

```
DELIMITER |
CREATE  PROCEDURE p()
BEGIN
 DECLARE v INT DEFAULT 1;
 
 CASE v
    WHEN 2 THEN SELECT v;
    WHEN 3 THEN SELECT 0;
    ELSE
       select 2;
    -- 若改为 END; 会报错
    END CASE;
 END;
|
```



case  then 不同数据类型对应的结果类型

```
--创建表
create table t1(id1 tinyint, id2 smallint, id3 mediumint, id4 int, id5 bigint);
insert into t1 values(1,11,111,1111,11111);

--测试1 （then 结果为整形）
mysql> create view v1 as select case id1 when 1 then 1 else 2 end c1 from t1;
Query OK, 0 rows affected (0.03 sec)

mysql> desc v1;
+-------+--------+------+-----+---------+-------+
| Field | Type   | Null | Key | Default | Extra |
+-------+--------+------+-----+---------+-------+
| c1    | int(1) | NO   |     | 0       |       |
+-------+--------+------+-----+---------+-------+
1 row in set (0.10 sec)

--测试2 （then 结果为decimal类型）
mysql> drop view v1;
Query OK, 0 rows affected (0.03 sec)

mysql> create view v1 as select case id1 when 1 then 1 else 2.0 end c1 from t1;
Query OK, 0 rows affected (0.04 sec)

mysql> desc v1;
+-------+--------------+------+-----+---------+-------+
| Field | Type         | Null | Key | Default | Extra |
+-------+--------------+------+-----+---------+-------+
| c1    | decimal(2,1) | NO   |     | 0.0     |       |
+-------+--------------+------+-----+---------+-------+
1 row in set (0.10 sec)

--测试3 （then 结果为double类型）
mysql> drop view v1;
Query OK, 0 rows affected (0.03 sec)

mysql> create view v1 as select case id1 when 1 then 1e0 else 2 end c1 from t1;
Query OK, 0 rows affected (0.04 sec)

mysql> desc v1;
+-------+--------+------+-----+---------+-------+
| Field | Type   | Null | Key | Default | Extra |
+-------+--------+------+-----+---------+-------+
| c1    | double | NO   |     | 0       |       |
+-------+--------+------+-----+---------+-------+
1 row in set (0.08 sec)


--测试4 （when 条件表达式为decimal类型）
mysql> drop view v1;
Query OK, 0 rows affected (0.03 sec)
mysql> create view v1 as select case id1 when 1.0 then 1 else 2 end c1 from t1;
Query OK, 0 rows affected (0.04 sec)

mysql> desc v1;
+-------+--------+------+-----+---------+-------+
| Field | Type   | Null | Key | Default | Extra |
+-------+--------+------+-----+---------+-------+
| c1    | int(1) | NO   |     | 0       |       |
+-------+--------+------+-----+---------+-------+
1 row in set (0.08 sec)

-- 推断
case 执行结果的类型受到case 各个then的结果的影响,不受when 条件表达式的影响。
```



case when 一些总结内容：

|编号|结论|测试现象|
|---|---|---|
|1|case 执行结果的类型受到case 各个then的结果的影响,不受when 条件表达式的影响|见上面,|
|2|如果有分支对应结果为NULL，则该case when 默认值为NULL|,mysql> create view v1 as select case id1 when 1 then 'adafa' else null  end c1 from t1;,Query OK, 0 rows affected (0.05 sec),,mysql> desc v1;,+-------+------------+------+-----+---------+-------+,| Field | Type       | Null | Key | Default | Extra |,+-------+------------+------+-----+---------+-------+,| c1    | varchar(5) | YES  |     | NULL    |       |,+-------+------------+------+-----+---------+-------+,1 row in set (0.09 sec)|
|3|case 表达式 和 when 表达式 的字符集不同，会根据字符集进行转换。见函数 ,void Item_func_case::fix_length_and_dec()|函数 Item_func_case::fix_length_and_dec 中注释内容,        If we'll do string comparison, we also need to aggregate,        character set and collation for first/WHEN items and,        install converters for some of them to cmp_collation when necessary.,        This is done because cmp_item compatators cannot compare,        strings in two different character sets.,        Some examples when we install converters:,        1. Converter installed for the first expression:,           CASE         latin1_item              WHEN utf16_item THEN ... END,        is replaced to:,           CASE CONVERT(latin1_item USING utf16) WHEN utf16_item THEN ... END,        2. Converter installed for the left WHEN item:,          CASE utf16_item WHEN         latin1_item              THEN ... END,        is replaced to:,           CASE utf16_item WHEN CONVERT(latin1_item USING utf16) THEN ... END|
|4|如果结果类型为整形，会给出显示宽度。,tinyint, smallint, mediumint 会将结果类型升级为 int(m), 其中m 对应结果最大宽度。|mysql> create view v1 as select case id1 when 1 then 1 else 2 end c1 from t1;,Query OK, 0 rows affected (0.03 sec),,mysql> desc v1;,+-------+--------+------+-----+---------+-------+,| Field | Type   | Null | Key | Default | Extra |,+-------+--------+------+-----+---------+-------+,| c1    | int(1) | NO   |     | 0       |       |,+-------+--------+------+-----+---------+-------+,1 row in set (0.10 sec)|
|5|结果为字符串类型，则字符串长度为then 结果的最大长度。|mysql> create view v1 as select case id1 when 1 then 'adafa' else 12334444 end c1 from t1;,Query OK, 0 rows affected (0.05 sec),,mysql> desc v1;,+-------+------------+------+-----+---------+-------+,| Field | Type       | Null | Key | Default | Extra |,+-------+------------+------+-----+---------+-------+,| c1    | varchar(8) | NO   |     |         |       |,+-------+------------+------+-----+---------+-------+,1 row in set (0.08 sec),|




### 1.2.2 if 函数

语法

```
IF (expr1, expr2, expr3)
```

说明

If expr1 is TRUE (expr1 <> 0 and expr1 IS NOT NULL), IF() returns expr2. Otherwise, it returns expr3.

If only one of expr2 or expr3 is explicitly NULL, the result type of the IF() function is the type of the non-NULL expression.  


The default return type of IF() (which may matter when it is stored into a temporary table) is calculated as follows:  


• If expr2 or expr3 produce a string, the result is a string.  
If expr2 and expr3 are both strings, the result is case-sensitive if either string is case-sensitive.


• If expr2 or expr3 produce a floating-point value, the result is a floating-point value.  


• If expr2 or expr3 produce an integer, the result is an integer.



示例

```
SELECT IF(1>2,2,3);

SELECT IF(1<2,'yes','no');

SELECT IF(STRCMP('test','test1'),'no','yes');
```



### 1.2.3 ifnull函数

语法

```
IFNULL (expr1, expr2)
```

说明

If expr1 is not NULL, IFNULL() returns expr1; otherwise it returns expr2

The default return type of IFNULL(expr1,expr2) is the more “general” of the two expressions, in the order STRING, REAL, or INTEGER. Consider the case of a table based on expressions or where MySQL must internally store a value returned by IFNULL() in a temporary table:



示例

```
SELECT IFNULL(1,0);

SELECT IFNULL(NULL,10);

SELECT IFNULL(1/0,10);

SELECT IFNULL(1/0,'yes');
```





### 1.2.4 nullif 函数

语法

```
NULLIF (expr1, expr2)
```

说明

Returns NULL if expr1 = expr2 is true, otherwise returns expr1. This is the same as CASE WHEN expr1 = expr2 THEN NULL ELSE expr1 END.

The return value has the same type as the first argument.



示例

```
SELECT NULLIF(1,1);

SELECT NULLIF(1,2);
```







##   [1.3 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#13-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|无||||






##   [1.4 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#14-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  





#   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#2-%E6%8E%A5%E5%8F%A3)  

Item *Item_func_case::find_item(String *str);

String *Item_func_case::val_str(String *str);



bool Item_func_if::fix_fields(THD *thd, Item **ref);

String * Item_func_if::val_str(String *str);



void Item_func_ifnull::fix_length_and_dec();

String * Item_func_ifnull::str_op(String *str);



void Item_func_nullif::fix_length_and_dec();

String * Item_func_nullif::val_str(String *str);



##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

无

##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

  


##   [5. 参考](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

MySQL  Reference Manual 中内置函数章节 （  [https://dev.mysql.com/doc/refman/5.7/  12.5 flow control functions](https://dev.mysql.com/doc/refman/5.7/en/encryption-functions.html#function_encode)  ）



