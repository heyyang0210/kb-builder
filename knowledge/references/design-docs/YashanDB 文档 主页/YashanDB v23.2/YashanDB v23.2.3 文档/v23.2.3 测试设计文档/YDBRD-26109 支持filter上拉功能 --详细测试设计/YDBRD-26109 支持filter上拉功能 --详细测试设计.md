Created by 许秋莹, last modified on 六月 11, 2024

# 1. 概述

从SQL执行逻辑上，谓词过滤的越早，其性能就越好，所以谓词上拉并不是将下面的谓词移动到上面执行，而是通过下面的谓词，根据等价关系，扩展出更多可用谓词，以帮助语句产生更多有效的谓词。本文档为支持Filter上拉功能的详细测试设计。

SR：    [https://pingcode.yasdb.com/pjm/items/6618a6a3fd997db58ad7dd6e](https://pingcode.yasdb.com/pjm/items/6618a6a3fd997db58ad7dd6e)    ?    
  #YDBRD-26109 支持Filter上拉功能

# 2. 需求分析

## 2.1 功能点分析

基于如下两个条件选择上拉谓词，满足其中的任意一个条件，都可以做为上拉谓词

- 上拉谓词的类型，需要满足规格与约束中的条件（见2.3）
- 基于投影或函数依赖的选择与裁剪，当view满足一些函数依赖关系时，不存在投影中的谓词也是可以被上拉的


## 2.2 应用场景

- 基于等价关系的上拉
- 这个语句中，  t1.id   = 5是在第一个from子查询ta中，但是在上层的关联中，存在  ta.id   =   tb.id  , 那么tb本身也可以增加一个filter   t2.id   = 5;
- 基于函数依赖的上拉  (暂时不支持)
- 如果ta满足functional dependency: [id] [other columns], tb满足functional dependency [id], [other columns]， 则ta表中的  t2.name   = 'TOM'是可以扩展到tb中的


```
select * from (select * from t1 where t1.id = 5) ta join (select * from t2) tb on ta.id = tb.id;
```

```
select * from (select * from t1，t2 *** t1.name = 'TOM') ta, (select * from t1, t3 **** ) tb where ta.id = tb.id;
```

## 2.3 规格约束

##### 2.3.1 目前支持的谓词

- 目前支持Expr <operator> const的谓词进行上拉和扩展
- Expr compare const或者交换
- Expr like/rlike const [escape const]或者交换
- Expr in (const list)或者交换
- Expr is/is not NULL
- Expr compare any/all const/const list，或者交换


##### 2.3.2 目前不支持的谓词

- in子查询和exists子查询暂时不支持。即使是非关联
- bool类型暂不支持，即使是只有Expr和常量
- Filter false不需要支持，会优化为对应的result false
- Filter true不需要支持，无任何过滤性


# 3. 详细测试设计

## 3.1 测试设计方法

*本测试设计主要采用等价类划分法，其中，3.2.6采用与其他场景混合的方法进行测试。*

## 3.2 详细测试设计

#### DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|Y|
|KT|Y|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|？|
|可维护性|  
|


#### 3.2.1  filter表类型

|等价类|备注|
|---|---|
|普通表|行列|
|分区表|  
|
|复制表|单机不支持|
|分布表|单机不支持|
|视图|  
|


#### 3.2.2  filter所在位置

|等价类|备注|
|---|---|
|where 后|```
select * from (select * from test_ydbrd26109_lsc_01 where id < 6)tb1 left join test_ydbrd26109_lsc_02 tb2 on tb1.id = tb2.id where tb2.id < 10;
```|
|having 后|```
select * from (select id from test_ydbrd26109_lsc_01 group by id having id < 6)tb1 left join test_ydbrd26109_lsc_02 tb2 on tb1.id = tb2.id where tb2.id < 10;
```|
|join on|- full join
- left join
- right join
- inner join
|


#### 3.2.3  filter类型

|类型|等价类|备注|示例|
|:---|:---|---|:---|
|where子句中的条件过滤|比较运算符过滤：  =、!=、<、>、<=、>=   |表达式类型覆盖全面|SELECT * FROM table_name WHERE column_name = value;|
|  
|逻辑运算符过滤：  AND、OR、NOT|  
|SELECT * FROM table_name WHERE condition1 AND condition2;|
|  
|模糊查询过滤：LIKE 、NOT LIKE|  
|SELECT * FROM table_name WHERE column_name LIKE 'value%';|
|  
|空值检查过滤：IS NULL 、 IS NOT NULL|  
|SELECT * FROM table_name WHERE column_name IS NULL;|
|  
|范围检查过滤：between and 、in 、 exists,  
|in：,- in 常量
- in 单列
- in list
- in subq
|SELECT * FROM table_name WHERE column_name BETWEEN min_value AND max_value;,SELECT * FROM table_name WHERE column_name IN (value1, value2, ...);|
|  
|窗口函数过滤：如：RANK、  ROW_NUMBER、RANK、NTILE|  
|SELECT column1, column2, ROW_NUMBER() OVER (PARTITION BY column1 ORDER BY column2) AS row_num FROM table_name WHERE row_num <= 10;|
|  
|聚合函数过滤：如：  SUM、AVG、COUNT|  
|SELECT column1, SUM(column2) AS total FROM table_name GROUP BY column1 HAVING total > 100;|
|  
|any / all / some|- 单列
- 多列
- 常量
- subq
|  
|
|  
|case when|  
|  
|
|  
|  
|  
|  
|
|having子句中的条件过滤|同上|  
|  
|
|join on 后的条件过滤|同上|  
|  
|


#### 3.2.4  filter条件值类型

|等价类|备注|
|:---|:---|
|常量|select * from tb1 where c1 = 1；|
|表达式|select * from tb1 where c1 = 9 + 1；|
|函数|select * from tb1 where c1 <= tan(id) ;|
|普通子查询,- 标量子查询
- 非标量子查询
|select * from tb1 where c1 < (select * from tb2 where id < 2);|
|join子查询,- outer join
- inner join
|select * from tb1 whre c1 < (select c1 from tb1 full join tb2 on tb1.id = tb2.id;)|
|集合子查询,- union
- intersect
- minus
|select * form tb1 where c1 > (select * from tb1 union select * form tb2);|
|可隐式转换列|select * form tb1 where id < cast('6' as float)  ;|
|伪列,- ROWSCN
- ROWID
- ROWNUM
- USER
|select * form tb1 where c1 < ROWID;|


#### 3.2.5  filter列数据类型

|等价类|备注|
|---|---|
|数值型：int, smallint, tinyint, bigint,float, double, number, |  
|
|字符型: CHAR, VARCHAR, NCHAR, NVARCHAR|  
|
|布尔型|  
|
|日期时间型:  day，time，timestamp，YtoM， DtoS|  
|
|大对象型：CLOB BLOB NCLOB|  
|
|RAW JSON ROWID|  
|


#### 3.2.6  filter和其他语法混合场景

|等价类|备注|
|---|---|
|filter内含and，or混合|- 只含有and
- 只含有or
- 都含and or
|
|filter个数|- 单个
- 多个 （<10）
- 100个
|
|filter两边条件互换|- id < 10
- 10 > id
|
|多表混合|- 普通表 join 复制表
- 普通表 join 分区表
- 复制表 join 普通表
- 复制表 join 分区表
- 分区表 join 普通表
- 分区表 join 复制表
,（不是重点）|
|包含CTE的场景|  
|
|结合外部引用的场景|  
|
|结合包含集合操作的场景|  
|
|投影列中的列是否都能上拉,上拉的列,- 单列
- 多列
|```
select * from (select * from test_ydbrd26109_lsc_01 where id < 6 and c2 = 21)tb1 left join test_ydbrd26109_lsc_02 tb2 on tb1.id = tb2.id and tb1.c2 = tb2.c2 where tb2.id < 10;
```|
|包含跨层上拉的场景|  
|
|包含绑定参数的场景|  
|
|组合join，inner join 组合outer join的场景|  
|
|投影列中含常量、参数|  
|


#### 3.2.7 以上场景混合开并行执行

#### 3.2.8 查询计划是否下推 

# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 本次测试采用yasft测试框架实现，执行sql文件，对比期望结果和实际输出结果，输出测试结果


# 6. 测试环境说明

|机器|内存|版本|数据库|
|:---|:---|:---|:---|
|192.168.18.85|31G|CentOS Linux release 7.9.2009 (Core)|开发提供安装包|


# 7. 工作量评估

工作量：8  *人天*

计划测试完成时间：2024/6/13

  


会议纪要：filter上拉测试设计评审

与会人：许秋莹、周湘淞、徐晓锋、刘清萍、马文英

会议时间：2024/5/27

会议地点：25座708

  
  纪要信息：

1. 补充含connect by、user等伪列
1. 补充投影列中含 常量、参数等，都可以上拉
1. 组合join，inner join 组合outer join
1. 补充绑定参数场景
1. 补充跨层上拉场景
1. 表达式类型都需要过一遍


  


评审通过与否：通过

## Attachments:

[YDBRD-26109-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZmI4OTcwYzJhZjRmNTIwZjgyIiwicmVmX2lkIjoiNjczOTZjZmE3MjgyMDZlZmI5MmYxOTcxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDk5LCJleHAiOjE3ODIzOTE0OTl9.xKe30OTqrQ0msX6OaMU1-6hqniR9xGJlRIxY6RQlTFI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
