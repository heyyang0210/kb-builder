Created by 李子怡 on 八月 27, 2024

IR:       [YASHAN-2914 【mysql兼容】支持常用MYSQL分区](https://pingcode.yasdb.com/ship/ideas/66618e805d57e18ea9d2046f)  

SR：    [YDBRD-29804 支持MySQL分区表语法](https://pingcode.yasdb.com/pjm/items/667bd324288e197820af3276)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#1-overview%E6%A6%82%E8%BF%B0)  

在原有的mysql table框架之上，适配分区表语法  。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1 支持MySQL创建分区表语法

![](https://pingcode.yasdb.com/atlas/files/public/67396eda8970c2af4f521bde/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUVBQUFBUUFBQUFBQVFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ0NDQsImV4cCI6MTc4MjQ1NTI0NH0.S5w5R6Lm2GNYVQtW0y1X5EIMp5Vm_MSYR3Ls5H6dIbQ)

yashan 分区类型（PartType）：范围分区(PART_RANGE)、列表分区(  PART_LIST  )、哈希分区(PART_HASH) 和间隔分区(  range分区的扩展  )

MySQL分区类型：范围分区（RANGE）、列表分区（LIST）、哈希分区（HASH）、KEY分区、RANGE COLUMNS、LIST COLUMNS、LINEAR HASH、LINEAR KEY

  


range分区：分区范围连续且不重叠，使用VALUES LESS THAN运算符按顺序定义。(区间，常用与日期相关)

list分区：  按分区键取值的列表进行分区，各分区的列表只不能重复。（离散值）

hash分区：对存放的数据进行hash计算决定放到哪个分区。（MOD）  HASH分区无需定义分区的条件。只需要指明分区数即可。

linear hash 分区： HASH分区的一种特殊类型。（hash算法不同）

组合分区：   hash-*组合分区， list-*组合分区， range-*组合分区。

                   MYSQL: It is only possible to mix RANGE/LIST partitioning with HASH/KEY partitioning for subpartitioning.

                                   只支持RANGE和LIST的分区，且子分区的类型只能为HASH和KEY。

|range 分区|range columns分区|
|---|---|
|~~接受表达式（函数调用，算术运算）~~|不接受表达式，只能是列名|
|~~比较的是标量 ，即数值的大小(单列)~~|允许多列  （最多16）  ，比较的是多个列值组成的列表|
|~~必须是整数对象（VALUES value for partition '***' must have type INT）~~,~~如果是timestamp类型，需要用unix_timestamp转换。~~,~~如果是datetime类型，用to_days或year等函数转换。~~|不限于整数对象， 支持string, date 和datetime|


  


|list 分区|list columns分区|
|---|---|
|~~接受表达式~~|不接受表达式，只能是列名|
|~~单列~~|允许多列|
|~~必须是整数对象~~|不限于整数对象， 支持string, date 和datetime|


  


|hash分区|key分区|linear hash分区|linear key分区|
|---|---|---|---|
|~~接受表达式~~|不接受表达式，只能是列名|  
|  
|
|~~只允许一列~~,~~expr返回的必须是整数值~~|允许多列（最多16）,如果在有主键或者唯一键的情况下，key中分区列可不指定，默认为主键或者唯一键，如果没有，则必须显性指定列。|允许多列|允许多列|
|算法：取MOD值|算法：取MD5值|算法：二次幂  （linear powers-of-two）算法|算法：二次幂  （linear powers-of-two）算法|
|不随数据量的增长而改变  （静态）|不随数据量的增长而改变  (静态)|可动态调整分区的数量和结构|  
|


  


*partition_definition：*    `（语法支持）`  

[STORAGE] ENGINE

COMMENT

DATA DIRECTORY  和  INDEX DIRECTORY

MAX_ROWS  和     MIN_ROWS

  


TABLESPACE （支持）

  


  


2 支持MySQL增加和删除分区语法

RANGE和LIST的分区管理：

增加分区语法：ALTER TABLE table_name ADD PARTITION(partition_list);    只能在分区列表的末尾添加。

                          ALTER TABLE table_name REORGANIZE PARTITION   partition_list INTO   (  partition_definitions  );    不仅能拆分分区，还可以用来合并分区。  (  **不支持**  )

                          ALTER TABLE table_name PARTITION BY ......(  **不支持**  )

删除分区语法：ALTER TABLE table_name DROP PARTITION partition_name

                         ALTER TABLE table_name TRUNCATE PARTITION partition_name  (只删除数据，不删除分区信息)

  


HASH和KEY的分区管理(不支持DROP, REORGANIZE)：

ALTER TABLE table_name COALESCE PARTITION  partition_num  裁partition_num个分区  (  **不支持**  )

ALTER TABLE table_name ADD PARTITION partition_num 加parition_num个分区  (  **不支持**  )

  


差异点：

a. range分区，yashan: values less than(maxvalue)  需要括号

                        mysql: values less than maxvalue  是否有括号都支持

b.list分区， yashan: values ()

                   mysql: values in ()

c. hash分区，yashan: 必须指定PARTITIONS子句。

                     mysql: 可以不用指定PARTITIONS子句，不指定时分区数为1。（不允许只写PARTITIONS，而不指定分区数）。

c.分区键与主键和唯一键的关系

分区表的分区表达式中使用的所有列必须是表可能具有的每个唯一键的一部分。

                       yashan: partitioned columns must be a subset of the key column of the unique index

                       mysql: A PRIMARY KEY must include all columns in the table's partitioning function

```
--unique key
CREATE TABLE t1 (
    col1 INT NOT NULL,
    col2 DATE NOT NULL,
    col3 INT NOT NULL,
    col4 INT NOT NULL,
    UNIQUE KEY (col1, col2)
)
PARTITION BY HASH(col3)
PARTITIONS 4;

-- primary key
CREATE TABLE t2 (
    col1 INT NOT NULL,
    col2 DATE NOT NULL,
    col3 INT NOT NULL,
    col4 INT NOT NULL,
    PRIMARY KEY(col1, col2)
)
PARTITION BY HASH(col3)
PARTITIONS 4;

--unique key + primary key
CREATE TABLE t3 (
    col1 INT NOT NULL,
    col2 DATE NOT NULL,
    col3 INT NOT NULL,
    col4 INT NOT NULL,
    PRIMARY KEY(col1, col3),
    UNIQUE KEY(col2)
)
PARTITION BY HASH(col2)
PARTITIONS 4;

--alter table ...add primary key
CREATE TABLE t_no_pk (c1 INT, c2 INT)
PARTITION BY RANGE(c1) (
PARTITION p0 VALUES LESS THAN (10),
PARTITION p1 VALUES LESS THAN (20),
PARTITION p2 VALUES LESS THAN (30),
PARTITION p3 VALUES LESS THAN (40)
);
ALTER TABLE t_no_pk ADD PRIMARY KEY(c2);

--alter table ...partition by...
CREATE TABLE np_pk (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(50),
    added DATE,
    PRIMARY KEY (id)
);
ALTER TABLE np_pk
PARTITION BY HASH( TO_DAYS(added))
PARTITIONS 4;

```

  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#3-interfaces%E6%8E%A5%E5%8F%A3)  

```
<code><span class="k">static</span> <span class="n">CodResult</span> <span class="nf">myParsePartitionOptions</span><span class="p">(</span><span class="n">AnlParser</span><span class="o">*</span> <span class="n">parser</span><span class="p">,</span> <span class="n">LangWord</span><span class="o">*</span> <span class="n">word</span><span class="p">,</span> <span class="n">TableDef</span><span class="o">*</span> <span class="n">def</span><span class="p">)&nbsp;

</span></code>
```

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- create partition table 约束同yashan, 详见:      [create partition table](https://conf.yasdb.com/display/YAS/Create+Partition+Table)  
- 一个表中主键和唯一键没有共同列时不能分区。add partition 约束同yashan, 详见：    [add partition](https://conf.yasdb.com/display/YAS/Add+Partition)  
- drop partition 约束同yashan，详见：    [drop partition](https://conf.yasdb.com/display/YAS/Drop+Partition)  
- 组合分区约束，详见：    [组合分区](https://conf.yasdb.com/pages/viewpage.action?pageId=107385745)  
- RANGE COLUMNS, LIST COLUMNS，  KEY，LINEAR KEY   分区对象只能是列，不能是基于列的表达式。
- 分区适用于一个表的所有数据和索引，不能只对数据进行分区而不对索引进行分区，反之亦然，也不能只对表的一部分进行分区。


  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

      1.重点关注  range按时间分区

      2.通过information_schema.partitions查看每个分区的具体信息。

      3.create table时关注table_options和patition_options在一起的情况

自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## Attachments:

[image2024-4-28_14-30-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGE4OTcwYzJhZjRmNTIxYmRjIiwicmVmX2lkIjoiNjczOTZlZGE1OTNmOTljOWZmMjM4YTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDQ0LCJleHAiOjE3ODI1MzA4NDR9.U-XHm0WuzjRM1BsROtLd8YeG2z66ZJnn_QzSVDvdI_A)

 (image/png)    


[image2024-4-28_14-55-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGE4OTcwYzJhZjRmNTIxYmRkIiwicmVmX2lkIjoiNjczOTZlZGE1OTNmOTljOWZmMjM4YTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDQ0LCJleHAiOjE3ODI1MzA4NDR9.R8oWCEP3sGF83qBx-BWuKXzv_q6kBp3STE6O_ic0Xrw)

 (image/png)    
