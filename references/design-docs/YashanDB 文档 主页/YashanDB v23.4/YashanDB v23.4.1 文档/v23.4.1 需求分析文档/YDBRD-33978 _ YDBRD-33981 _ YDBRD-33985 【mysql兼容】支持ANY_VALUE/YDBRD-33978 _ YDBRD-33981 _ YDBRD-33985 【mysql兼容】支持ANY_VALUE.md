Created by 胡晓畔, last modified on 十一月 08, 2024



-   [1. 需求概述](#YDBRD33978/YDBRD33981/YDBRD33985【mysql兼容】支持ANY_VALUE、SLEEP和VALUES函数测试调研-1.需求概述)  
-   [2. 友商的实现情况](#YDBRD33978/YDBRD33981/YDBRD33985【mysql兼容】支持ANY_VALUE、SLEEP和VALUES函数测试调研-2.友商的实现情况)  
-   [3. 示例](#YDBRD33978/YDBRD33981/YDBRD33985【mysql兼容】支持ANY_VALUE、SLEEP和VALUES函数测试调研-3.示例)  
    -   [ANY_VALUE](#YDBRD33978/YDBRD33981/YDBRD33985【mysql兼容】支持ANY_VALUE、SLEEP和VALUES函数测试调研-ANY_VALUE)  
    -   [SLEEP](#YDBRD33978/YDBRD33981/YDBRD33985【mysql兼容】支持ANY_VALUE、SLEEP和VALUES函数测试调研-SLEEP)  
    -   [VALUES](#YDBRD33978/YDBRD33981/YDBRD33985【mysql兼容】支持ANY_VALUE、SLEEP和VALUES函数测试调研-VALUES)  
-   [4. 参考文档](#YDBRD33978/YDBRD33981/YDBRD33985【mysql兼容】支持ANY_VALUE、SLEEP和VALUES函数测试调研-4.参考文档)  
-   [5. 后续关注 ](#YDBRD33978/YDBRD33981/YDBRD33985【mysql兼容】支持ANY_VALUE、SLEEP和VALUES函数测试调研-5.后续关注)  




# 1. 需求概述

IR：

  [https://pingcode.yasdb.com/ship/ideas/66cc25ea4283cf23d4f3b3bc](https://pingcode.yasdb.com/ship/ideas/66cc25ea4283cf23d4f3b3bc)    ?    
  #YASHAN-3169 【mysql兼容】支持ANY_VALUE、SLEEP和VALUES函数

SR：

  [https://pingcode.yasdb.com/pjm/items/670a4d22e489dd0868f64fb6](https://pingcode.yasdb.com/pjm/items/670a4d22e489dd0868f64fb6)    ?    
  #YDBRD-33978 【mysql兼容】支持ANY_VALUE函数

  [https://pingcode.yasdb.com/pjm/items/670a4dc2e489dd0868f65183](https://pingcode.yasdb.com/pjm/items/670a4dc2e489dd0868f65183)    ?    
  #YDBRD-33981 【mysql兼容】支持SLEEP函数

  [https://pingcode.yasdb.com/pjm/items/670a52d2e489dd0868f6606e](https://pingcode.yasdb.com/pjm/items/670a52d2e489dd0868f6606e)    ?    
  #YDBRD-33985 【mysql兼容】支持VALUES函数

ANY_VALUE：聚合函数，用于在GROUP BY查询中获取任意一条记录的值[一组中第一个值]

SLEEP：将当前查询暂停（睡眠）指定的秒数

VALUES：

# 2. 友商的实现情况

|特性|友商|实现情况|
|:---|:---|:---|
|ANY_VALUE|MySQL|MySQL中的一种聚合函数，用于在GROUP BY查询中获取任意一条记录的值,可用于任何数据类型的字段，包括数值、字符串、日期等,~~返回的是指定字段的一个值，但是无法保证是第一条记录的值，因为MySQL在GROUP BY查询中的行为是不确定的。  ~~    应该 返回一组中第一个的值,any_value(expression),  `expression`   是一个有效的MySQL表达式，可以是字段名、常量、子查询等。,  
|
|SLEEP|MySQL|指定延时时间，一个入参  单位为秒 ，可以是小数,入参为null时 报错|
|VALUES|MySQL|需求场景：,支持如下语句,INSERT INTO VALUES(..) ON Duplicate key update c1=values(c2),在on duplicate key update子句中，可以使用values函数来取待插入列的新值。其他场景，VALUES均返回NULL|




# 3. 示例

## ANY_VALUE

  


|  
|场景|用例|  
|  
|
|---|---|---|---|---|
|1|入参为COLUMN|ONLY_FULL_GROUP_BY在mysql 默认启用，这种情况下，SELECT name, address,MAX(age) FROM  t  GROUP BY name 报错，失败的原因是，address 是非聚合列，既未在GROUP BY列中命名，也不在功能上依赖于它们。因此，address每个name组内的行的值都是不确定的。,**这里可以用 ANY_VALUE()指代 address。**,```
drop table if exists table_anyvalue;
create table table_anyvalue(id  int, name varchar(100),age int , address varchar(100));

insert into table_anyvalue values(1,'alice',15,'aaa');
insert into table_anyvalue values(2,'alice',16,'bbb');
insert into table_anyvalue values(3,'demo',15,'nnn');
insert into table_anyvalue values(4,'demo',17,'mmm');
insert into table_anyvalue values(5,'dav',15,'fff');
insert into table_anyvalue values(6,'dav',18,'hhh');
insert into table_anyvalue values(7,'anna',15,'bbb');

-- error ;this is incompatible with sql_mode=only_full_group_by
SELECT name,address, MAX(age) FROM table_anyvalue GROUP BY name;


SELECT name,  MAX(age) FROM table_anyvalue GROUP BY name;


SELECT name, ANY_VALUE(address), MAX(age) FROM table_anyvalue GROUP BY name;
```|  
,  
,![](https://pingcode.yasdb.com/atlas/files/public/6739e438a1ad9a3311de26d0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),  
,  
,  
,ANY_VALUE(address) 返回值是 name分组中的第一个值,  
|  
,  
,  
,  
|
|2|入参为常量|```
SELECT name, ANY_VALUE(1), MAX(age) FROM table_anyvalue GROUP BY name;
```|![](https://pingcode.yasdb.com/atlas/files/public/6739e438a1ad9a3311de26d1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)|  
|
|3|入参为标量子查询 |```
SELECT name, ANY_VALUE((select address from table_anyvalue limit 1)), MAX(age) FROM table_anyvalue GROUP BY name;
```|![](https://pingcode.yasdb.com/atlas/files/public/6739e4388970c2af4f53a87f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)|  
|
|4|入参为null 返回null|```
SELECT name, ANY_VALUE(null), MAX(age) FROM table_anyvalue GROUP BY name;
```|![](https://pingcode.yasdb.com/atlas/files/public/6739e438a1ad9a3311de26d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)|  
|
|5|sql中的列存在依赖关系,  
|sql中的列存在依赖关系 时sql语句可能报错,**any_value 可使这类查询有效**,```
SELECT age FROM table_anyvalue GROUP BY age-1;

SELECT ANY_VALUE(age) FROM table_anyvalue GROUP BY age-1;
```|  
,** **,  
,![](https://pingcode.yasdb.com/atlas/files/public/6739e4388970c2af4f53a880/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)|  
|
|6|在没有group by 子句的情况下引用聚合函数 |在没有group by 子句的情况下引用聚合函数的查询,**any_value 可使这类查询有效**,```
-- 报错
SELECT name, MAX(age) FROM table_anyvalue;

SELECT ANY_VALUE(name), MAX(age) FROM table_anyvalue;
```,```
drop table  table_anyvalue;
create table table_anyvalue(id  int, name varchar(100),age int , address varchar(100));

insert into table_anyvalue values(1,'',15,'aaa');
insert into table_anyvalue values(2,'alice',16,'bbb');
insert into table_anyvalue values(3,'demo',15,'nnn');
insert into table_anyvalue values(4,'demo',17,'mmm');
insert into table_anyvalue values(5,'dav',15,'fff');
insert into table_anyvalue values(6,'dav',18,'hhh');
insert into table_anyvalue values(7,'anna',15,'bbb');

SELECT ANY_VALUE(name), MAX(age) FROM table_anyvalue;
```|![](https://pingcode.yasdb.com/atlas/files/public/6739e438a1ad9a3311de26d3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),ANY_VALUE(name) 返回一个随机的name值 – 是否是  一组数据里第一条数据 ？-是,  
,  
,第一个值为null时 ，返回null,![](https://pingcode.yasdb.com/atlas/files/public/6739e438a1ad9a3311de26d4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)|  
|
|7|null  ,  
|一组的第一个值为null就是返回null。,其余代码层面的实现与函数功能表现无关 暂时无需关注|  
|  
|
|8|无 group by 直接查询ANY_VALUE(COLUMN) |```
SELECT ANY_VALUE(name)  FROM table_anyvalue;

等价于 SELECT name  FROM table_anyvalue;
```|![](https://pingcode.yasdb.com/atlas/files/public/6739e4388970c2af4f53a881/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)|  
|
|9|数据类型|```
drop table table_anyvalue_data;
create table table_anyvalue_data
(
    a1  int,
    a2  tinyint,
    a3  smallint,
    a4  bigint,
    a5  decimal,
    a6  float,
    a7  double,
    a8  char(10),
    a9  varchar(10),
    a10 char,
    a11 text,
    a12 blob,
    a13 BINARY(10),
    a14 date,
    a15 time,
    a16 timestamp,
    a19 boolean,
    a20 bit
);
   
insert into table_anyvalue_data
values (1, 1, 1, 1,1, 1, 1,'char10', 'varchar10','c','TINYTEXT', 'aa', null,'2022-03-20', '16:17:18.123456', '2022-03-20 16:17:18.123456',1,1);

create or replace view v1 as select * from table_anyvalue_data;

create or replace view v2 as select any_value(a1) a1,any_value(a2) a2,any_value(a3) a3,
any_value(a4) a4,
any_value(a5) a5,
any_value(a6) a6,
any_value(a7) a7,
any_value(a8) a8,
any_value(a9) a9,
any_value(a10) a10,
any_value(a11) a11,
any_value(a12) a12,
any_value(a13) a13,
any_value(a14) a14,
any_value(a15) a15,
any_value(a16) a16,
any_value(a19) a19,
any_value(a20) a20  from table_anyvalue_data;


desc v1;

desc v2;
```|  
,  
,  
,  
,![](https://pingcode.yasdb.com/atlas/files/public/6739e438a1ad9a3311de26d5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),  
,  
,  
,  
,  
,  
,除类型本身的映射区别以外【比如mysql的bool实际实现为tinyint，但是崖山仍然是bool】，,float – float  不对齐5.7,其余规格理应同mysql一致。|  
|




## SLEEP

||场景|用例|表现|备注|
|---|---|---|---|---|
|1|参数1个，正常执行返回 0,无参报错；,入参为null报错；,入参为负数报错；,支持能隐式转换为数字的字符,,空串返回0 ,空格串返回0,,,不能转换数字的字符 ，返回0 但warning ，对应崖山表现是 报错|```
-- 入参
--无参报错
--入参为null报错


SELECT SLEEP(null);


SELECT SLEEP('');
SELECT SLEEP('   ');


SELECT SLEEP(1);
SELECT SLEEP('1');
 
 


```|![image.png](https://pingcode.yasdb.com/atlas/files/public/673db1d78970c2af4f53b65c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),,![image.png](https://pingcode.yasdb.com/atlas/files/public/673db284a1ad9a3311de34b3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),![image.png](https://pingcode.yasdb.com/atlas/files/public/673db2aaa1ad9a3311de34b4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),![image.png](https://pingcode.yasdb.com/atlas/files/public/673db2d9a1ad9a3311de34b6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)|空串不为null时，崖山返回什么？,|
|2|结合时间函数使用,,当前时间前后查询不变；,执行中的动态时间在sleep之后查询，会看到增加对应的时间|```
-- 当前时间

SELECT NOW(),SLEEP(2),NOW();


-- 执行中的动态时间
SELECT SYSDATE(),SLEEP(10),SYSDATE();

SELECT NOW(),SYSDATE(), SLEEP(1),SYSDATE(), NOW() ;


```|![image.png](https://pingcode.yasdb.com/atlas/files/public/673db465a1ad9a3311de34bb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),,![image.png](https://pingcode.yasdb.com/atlas/files/public/673db47ea1ad9a3311de34bc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),,![image.png](https://pingcode.yasdb.com/atlas/files/public/673db492a1ad9a3311de34be/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),||
|3|参数为小数时,可以精确到毫秒时间,|```
SELECT SYSDATE(3),SLEEP(2),SYSDATE(3);
SELECT SYSDATE(3),SLEEP(2.4),SYSDATE(3);
SELECT SYSDATE(3),SLEEP(2.6),SYSDATE(3);

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/673ed5a28970c2af4f53b6ca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),可以看到 400 毫秒  600毫秒的变化,|参数为小数的处理 崖山是否对齐 |
|4|用来模拟慢查询,当一个表中有多条数据，执行时间为：,记录数 * 休眠时间,,, , |```
-- 当一个表 中有2条数据
drop table table_sleep ;
create table table_sleep(a int);
insert into table_sleep values (1);
insert into table_sleep values (2);



select a.*  from table_sleep a;
 
select a.*,sleep(2) from table_sleep a;
 
```|![image.png](https://pingcode.yasdb.com/atlas/files/public/673ed71b8970c2af4f53b6cb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),||
|5|sleep 函数 放在投影列,filter无匹配时 不会实际执行 sleep 睡眠,,,|```
-- sleep 函数放在投影列

-- 不会实际执行 sleep 睡眠
select sleep(2),a  from table_sleep where a=10;
select sleep(2),a  from table_sleep where a=10 and sleep(2);
select sleep(2),a  from table_sleep where a=3 and sleep(2);
 

-- 实际执行 sleep 睡眠
-- 时间为 记录数 * 休眠时间
select sleep(2),a  from table_sleep where a=10 or sleep(2);
select sleep(2),a  from table_sleep where a=3 or sleep(2);
select * from table_sleep  where sleep(1);



```|![image.png](https://pingcode.yasdb.com/atlas/files/public/673ed8d2a1ad9a3311de3521/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),,,![image.png](https://pingcode.yasdb.com/atlas/files/public/673ed8eea1ad9a3311de3522/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)||
|6|sleep 函数 放在where之后,支持select update  delete ,,,, 需注意，mysql中 ：,更新一条数据的时间,整表记录数 * 休眠时间,,删除一条数据的时间,（整表记录数 - 匹配记录数） * 休眠时间,,,|```
-- 生效但无结果改变
select * from table_sleep ;
update table_sleep set a =4 where sleep(2) and a=1;
select * from table_sleep ;

-- 生效且有结果改变
select * from table_sleep ;
update table_sleep set a =4 where sleep(2) or a=1;
select * from table_sleep ;

-- 睡眠生效但无结果改变

delete from  table_sleep  where a=2 and sleep(2);
select * from table_sleep ;


-- 睡眠生效且有结果改变
delete from  table_sleep  where a=2 or sleep(2);
select * from table_sleep ;


drop table table_sleep ;
create table table_sleep(a int);
insert into table_sleep values (1);
insert into table_sleep values (2);
insert into table_sleep values (3);
insert into table_sleep values (4);
insert into table_sleep values (5);
commit;
delete from  table_sleep  where a=2 or sleep(2);

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/673ed9a88970c2af4f53b6ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),,![image.png](https://pingcode.yasdb.com/atlas/files/public/673ed9db8970c2af4f53b6cf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),,![image.png](https://pingcode.yasdb.com/atlas/files/public/673eda878970c2af4f53b6d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)||
|7|运算中使用,以 0 使用,,,除法报错,|```
select str_to_date('08.09.2020 08:09:30', '%m.%d.%Y %h:%i:%s.%f') + sleep(1);

select str_to_date('08.09.2020 08:09:30', '%m.%d.%Y %h:%i:%s.%f') - sleep(1);


select str_to_date('08.09.2020 08:09:30', '%m.%d.%Y %h:%i:%s.%f') * sleep(1);

--休眠1秒后返回与0计算的结果 

--除法报错

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/673f26388970c2af4f53b72a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),,||
|8|函数|```
select concat(2222 ,sleep(1));

select concat('a' ,sleep(1));

-- 休眠后返回与 0 拼接结果

select atan( sleep(1));
--休眠后返回与0计算的结果 

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/673f2772a1ad9a3311de359e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),![image.png](https://pingcode.yasdb.com/atlas/files/public/673f27a5a1ad9a3311de359f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)||
|9|mysql可以用 DO执行|DO SLEEP(2);|mysql> DO SLEEP(2);,Query OK, 0 rows affected (2.01 sec),||
|10|函数返回值|create or replace view v1 as select  sleep(1) ;,desc v1;,,drop table test1;,create table test1 as select  sleep(1) ;,,insert into test1 select  sleep(2);  --休眠,,,**create view as 不休眠，原因是？**|![image.png](https://pingcode.yasdb.com/atlas/files/public/673f2814a1ad9a3311de35a0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),,![image.png](https://pingcode.yasdb.com/atlas/files/public/673f285da1ad9a3311de35a1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),,![image.png](https://pingcode.yasdb.com/atlas/files/public/673f28e9a1ad9a3311de35a3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),,,||
|11 |数据类型,,支持数值型，可转数值的字符型，,clob blob  binary  time   Boolean   bit 类型,,崖山是否支持rowid urowid  xmltype等？|```

drop table table_sleep_data;
create table table_sleep_data
(
    a1  int,
    a2  tinyint,
    a3  smallint,
    a4  bigint,
    a5  decimal,
    a6  float,
    a7  double,
    a8  char(10),
    a9  varchar(10),
    a10 char,
    a11 text,
    a12 blob,
    a13 BINARY(10),
     
    a15 time,
     
    
    a19 boolean,
    a20 bit,
    a21 nchar(1),
    a22 nvarchar(1)
    
);
   
insert into table_sleep_data
values (1, 1, 1, 1, 1, 1, 1,1,1,1, 1, 1,1, 1, 1,1,  1, 1); 

create or replace view v1 as select * from table_sleep_data;

create or replace view v2 as select sleep(a1) a1,sleep(a2) a2,sleep(a3) a3,
sleep(a4) a4,
sleep(a5) a5,
sleep(a6) a6,
sleep(a7) a7,
sleep(a8) a8,
sleep(a9) a9,
sleep(a10) a10,
sleep(a11) a11,
sleep(a12) a12,
sleep(a13) a13,

sleep(a15) a15,


sleep(a19) a19,
sleep(a20) a20 ,
sleep(a20) a21 ,
sleep(a20) a22

 from table_sleep_data;


desc v1;

desc v2;


```|![image.png](https://pingcode.yasdb.com/atlas/files/public/673f29dea1ad9a3311de35a4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)||
|12|如果 SLEEP() 是一个查询中唯一调用的东西，它被中断后返回 1。  ,,如果 SLEEP() 只是一个查询中的一部分，它被中断后返回一个错误。,|select sleep(1000);,-- Ctrl + C ,, select 1 where  sleep(1000);,-- Ctrl + C |![image.png](https://pingcode.yasdb.com/atlas/files/public/6743eb488970c2af4f53b7d3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),![image.png](https://pingcode.yasdb.com/atlas/files/public/6743eb52a1ad9a3311de3664/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),|5.7.16 的bug 导致无法显示,8.0可以,|




## VALUES

|场景|用例|表现|备注|
|---|---|---|---|
|8.0中 values函数用法|```
 VALUES ROW(1,-2,3), ROW(5,7,9), ROW(4,6,8);
```|![image.png](https://pingcode.yasdb.com/atlas/files/public/6747d7c1a1ad9a3311de38a4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)||
|本需求场景,INSERT INTO VALUES(..) ON Duplicate key update c1=values(c2), |```
drop table  products;

CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10, 2),
    UNIQUE (name)
);


-- name 唯一约束

-- 插入部分数据   truncate table products;

insert into products values (1,'aaa',1.2);
insert into products values (2,'bbb',1.2);
insert into products values (3,'ccc',1.2);
--想插入一条记录，如果 name 字段的值已经存在，就更新该记录的 price
INSERT INTO products (id, name, price)
VALUES (1, 'aaa', 999.99)
ON DUPLICATE KEY UPDATE price = VALUES(price);


```|![image.png](https://pingcode.yasdb.com/atlas/files/public/674da36da1ad9a3311de3d80/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)|2 rows affected,在mysql中显示2 ,按照过往 rowcount的实现，此处崖山是否返回1 ？,,只显示实际变化的条数 ,一行更新 1|
||```
-- 如果ID重复，name不重复 ，但price = VALUES(price) 更新该记录的 price
INSERT INTO products (id, name, price)
VALUES (1, 'ddd', 99.99)
ON DUPLICATE KEY UPDATE price = VALUES(price);

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/674da418a1ad9a3311de3d81/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)||
||```
-- 如果ID重复，name price 都不重复 ，但name = VALUES(name) 只更新该记录的 name

INSERT INTO products (id, name, price)
VALUES (1, 'ddd', 999.99)
ON DUPLICATE KEY UPDATE name = VALUES(name);

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/674da46ca1ad9a3311de3d82/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)||
||```
-- 如果ID重复，name price 都不重复 ，但name = VALUES(name) price = VALUES(price) name price 都更新

INSERT INTO products (id, name, price)
VALUES (1, 'fff', 88.99)
ON DUPLICATE KEY UPDATE name = VALUES(name),price = VALUES(price);

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/674da4e8a1ad9a3311de3d83/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)||
||```
--多行插入的示例, 两行更新  一行插入
INSERT INTO products (id, name, price)
VALUES
(1, 'Laptop', 999.99),
(2, 'Phone', 499.99),
(4, 'Phone2', 199.99)
ON DUPLICATE KEY UPDATE name = VALUES(name),price = VALUES(price);

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/674da56da1ad9a3311de3d84/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc),![image.png](https://pingcode.yasdb.com/atlas/files/public/674da57ca1ad9a3311de3d85/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)|5 rows affected,,两行更新  一行插入,2*2 +1|
||```
-- 多行更新，第一行ID变化，第二行 name 变化，第三行 price 变化
INSERT INTO products (id, name, price)
VALUES
(11, 'Laptop', 999.99),
(2, 'Phone222', 499.99),
(4, 'Phone2', 0.99)
ON DUPLICATE KEY UPDATE ID= values(id), name = VALUES(name),price = VALUES(price);

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/674da620a1ad9a3311de3d86/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)||
||```
-- 多行更新，第一行ID name 都变化，第二行 name 变化，第三行 price 变化
INSERT INTO products (id, name, price)
VALUES
(1, 'Laptop000', 999.99),
(2, 'Phone222', 499.99),
(4, 'Phone2', 0.99)
ON DUPLICATE KEY UPDATE ID= values(id), name = VALUES(name),price = VALUES(price);

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/674da695a1ad9a3311de3d88/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)|,无冲突，,相当于新增1行 ID=1 的数据,|
|其他场景，VALUES均返回NULL, |```
select id= values(id)  from products  ;


select values(id) from products;

```|![image.png](https://pingcode.yasdb.com/atlas/files/public/674ea96ea1ad9a3311de3e22/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0lBSVFDd0FnQmdFQUNNUWdNQUlKQUlBU3dnQkFJZ0FnRkVRQUVlQUVKQUE0Q2dBZ0FJSmdEbUNCRVF4QVFJZ0JFQ0VBRmlBQUlDQU1EZ0tBSUFRZ0JSRUlVTkFCRUpBQXdHQUN3QUFFZ1NBQmdBRElBUkFRQUtCQUFBaVlqRWdnakFNQ0FNeWdRaUlRQlRnQUpZQ0xFQVFDRUlBVUFVQWhRckV3QUdJQUl3PSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1NzksImV4cCI6MTc4MjQ2NjM3OX0.4zmfOifrNb3PUGl9NosPI9kp92b0Qjx-jwXxRgRryjc)||
||```
select * from products where id= values(id);

```|正常执行，无结果返回||
|values(id) 返回值为null 应用|```
select * from products where   values(id) is null;


```|返回整表数据||


  


  


  


# 4. 参考文档

  


  


# 5. 后续关注 

  


  


  


  


  


  


## Attachments:

[image2024-10-30_11-27-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0MzdhMWFkOWEzMzExZGUyNmM2IiwicmVmX2lkIjoiNjczOWU0Mzc1OTNmOTljOWZmMjVkOWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTc4LCJleHAiOjE3ODI1NDE5Nzh9.uGa1_upyOo9L65-DvnE5PvbX9GAc51cVhkWD15i3alQ)

 (image/png)    


[image2024-10-30_11-17-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0Mzc4OTcwYzJhZjRmNTNhODc3IiwicmVmX2lkIjoiNjczOWU0Mzc1OTNmOTljOWZmMjVkOWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTc4LCJleHAiOjE3ODI1NDE5Nzh9.kUUAzapS5Im7IqD33Gn1evCVDYKpP5z_oleTYKTot3c)

 (image/png)    


[image2024-10-29_16-58-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0Mzc4OTcwYzJhZjRmNTNhODc4IiwicmVmX2lkIjoiNjczOWU0Mzc1OTNmOTljOWZmMjVkOWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTc4LCJleHAiOjE3ODI1NDE5Nzh9.cALk5ER0aViuPkYPdstJT7bcOnYZcDJnVqVkhHNMsVU)

 (image/png)    


[image2024-10-29_16-31-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0MzdhMWFkOWEzMzExZGUyNmM3IiwicmVmX2lkIjoiNjczOWU0Mzc1OTNmOTljOWZmMjVkOWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTc4LCJleHAiOjE3ODI1NDE5Nzh9.xhX7nL7ogUahzX5H6ZkCCkklw-_KALtWUmsc-NDQYZc)

 (image/png)    


[image2024-10-29_16-31-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0Mzc4OTcwYzJhZjRmNTNhODc5IiwicmVmX2lkIjoiNjczOWU0Mzc1OTNmOTljOWZmMjVkOWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTc4LCJleHAiOjE3ODI1NDE5Nzh9.m2bQUH_H_-jvujUYKHfWaDNxm4DHy1lkQXwoXZhxKuo)

 (image/png)    


[image2024-10-29_16-28-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0MzdhMWFkOWEzMzExZGUyNmM4IiwicmVmX2lkIjoiNjczOWU0Mzc1OTNmOTljOWZmMjVkOWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTc4LCJleHAiOjE3ODI1NDE5Nzh9.F943MoKo19dd4LXY0phhwwOkCjKWsZcMpYDdSkfv9JM)

 (image/png)    


[image2024-10-29_16-22-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0Mzc4OTcwYzJhZjRmNTNhODdhIiwicmVmX2lkIjoiNjczOWU0Mzc1OTNmOTljOWZmMjVkOWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTc4LCJleHAiOjE3ODI1NDE5Nzh9.uXRqPwDh6BBlj7CXYGXqtDg2RO5fRcz5wyOaYrYDxHk)

 (image/png)    


[image2024-10-29_16-22-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0MzdhMWFkOWEzMzExZGUyNmM5IiwicmVmX2lkIjoiNjczOWU0Mzc1OTNmOTljOWZmMjVkOWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTc4LCJleHAiOjE3ODI1NDE5Nzh9.p5PJkCZUEAg4xbcZjIDo4_I5jGZkyUAChFcmRQLl6H4)

 (image/png)    


[image2024-10-28_17-43-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWU0MzdhMWFkOWEzMzExZGUyNmNhIiwicmVmX2lkIjoiNjczOWU0Mzc1OTNmOTljOWZmMjVkOWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTc4LCJleHAiOjE3ODI1NDE5Nzh9.YUNyLWGpw2fre0QU2aQI57K8MrMSi4EO9TlnX8Kc9Uo)

 (image/png)    


## Comments:

|  [](null)  ,  [特性调研-YDBRD-33978：支持ANY_VALUE函数 - 王博文 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=177833134)  ,  [详细设计-YDBRD-33978：支持ANY_VALUE函数 - 王博文 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=177832898)  ,Posted by huxiaopan at 十月 30, 2024 20:00|
|---|


