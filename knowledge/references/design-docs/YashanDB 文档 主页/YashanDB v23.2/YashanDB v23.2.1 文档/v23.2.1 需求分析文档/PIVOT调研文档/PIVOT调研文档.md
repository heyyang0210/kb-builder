Created by 谭思宇, last modified on 十一月 25, 2023

参考链接：    [Oracle / PLSQL: PIVOT Clause (techonthenet.com)](https://www.techonthenet.com/oracle/pivot.php)  

## **一. 语法图**

![](https://pingcode.yasdb.com/atlas/files/public/67396c4ea1ad9a3311dc8973/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0)

![](https://pingcode.yasdb.com/atlas/files/public/67396c4e8970c2af4f520b06/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0)

从语法位置上来说，可以把pivot当成一个特殊的groupby clause

## **二. 语义**

pivot子句本身的作用是将 subquery1_project_column 按照 in list的值展开，同时输出对应聚合列的结果。

最终整体的输出为

select_list原始投影 减去 for列 加上 inlist 笛卡尔积 aggregate_expression 

## **三. 语法场景**

往下用到的建表语句：

```
CREATE TABLE orders
( order_id integer NOT NULL,
  customer_ref varchar2(50) NOT NULL,
  order_date date,
  product_id integer,
  quantity integer,
  CONSTRAINT orders_pk PRIMARY KEY (order_id)
);

insert into orders values(50001, 'SMITH', NULL, 10, NULL);
insert into orders values(50002, 'SMITH', NULL, 20, NULL);
insert into orders values(50003, 'ANDERSON', NULL, 30, NULL);
insert into orders values(50004, 'ANDERSON', NULL, 40, NULL);
insert into orders values(50005, 'JONES', NULL, 10, NULL);
insert into orders values(50006, 'JONES', NULL, 20, NULL);
insert into orders values(50007, 'SMITH', NULL, 20, NULL);
insert into orders values(50008, 'SMITH', NULL, 10, NULL);
insert into orders values(50009, 'SMITH', NULL, 20, NULL);
commit;


CREATE TABLE lineitem
(
    L_ORDERKEY      INTEGER         ,
    L_COMMENT       VARCHAR(44)    
);

insert into lineitem values(50001, 'comment1');
insert into lineitem values(50002, 'comment2');
insert into lineitem values(50003, 'comment3');
insert into lineitem values(50004, 'comment4');
insert into lineitem values(50005, 'comment5');
insert into lineitem values(50006, 'comment6');
commit;

```

  


**1. 从语法位置上来说pivot前面的查询可以为任意形式的查询，包括CTE**

|查询|SQL|output|
|---|---|---|
|单表查询|```
SELECT order_id, "10" as "count(product_id)=10", "20" as "count(product_id)=20" FROM orders
PIVOT
(
  COUNT(product_id)
  FOR product_id IN (10, 20)
);

```|![](https://pingcode.yasdb.com/atlas/files/public/67396c4e8970c2af4f520b08/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0)|
|join|```
SELECT * FROM orders o1 inner join lineitem o2 on ORDER_ID = l_orderkey
PIVOT
(
  COUNT(product_id)
  FOR product_id IN (10, 20)
);

```,部分写法的join不允许使用（实际只能使用通过on条件显式写出的join）,```
SELECT * FROM orders, lineitem
PIVOT
(
  COUNT(product_id)
  FOR product_id IN (10, 20)
);

```|不含pivot执行结果,![](https://pingcode.yasdb.com/atlas/files/public/67396c4e8970c2af4f520b09/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0),含pivot,![](https://pingcode.yasdb.com/atlas/files/public/67396c4ea1ad9a3311dc8978/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0)|
|集合操作|```
SELECT order_id, customer_ref FROM orders union all select l_orderkey, l_comment from lineitem
PIVOT
(
  COUNT(order_id)
  FOR order_id IN (10, 20, 30)
);


```|![](https://pingcode.yasdb.com/atlas/files/public/67396c4ea1ad9a3311dc8979/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0),报错|
|from子查询|```
select * from (
SELECT order_id, customer_ref FROM orders union all select l_orderkey, l_comment from lineitem
)
PIVOT
(
  COUNT(order_id)
  FOR order_id IN (50001, 50002, 50003, 50004)
);

```|![](https://pingcode.yasdb.com/atlas/files/public/67396c4ea1ad9a3311dc897a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0),（包含pivot的子查询不允许上提）|
|group by,order by,where filter,cby|从语法位置上来看，pivot本身相当于一个特殊的groupby子句，因此其前面无法出现where条件，groupby子句和orderby子句，这些子句只能出现在pivot后面,以下场景为合法场景：,```
SELECT count(order_id), ten, twenty FROM orders
PIVOT
(
  count(product_id)
  FOR product_id IN (10 as ten, 20 as twenty)
) group by ten, twenty;

SELECT ten, twenty FROM orders
PIVOT
(
  count(product_id)
  FOR product_id IN (10 as ten, 20 as twenty)
) 
where ten &gt; 0;

SELECT ten, twenty FROM orders
PIVOT
(
  count(product_id)
  FOR product_id IN (10 as ten, 20 as twenty)
) 
order by 1;

--复杂混用场景
SELECT count(customer_ref), ten FROM orders
PIVOT
(
  count(product_id)
  FOR product_id IN (10 as ten, 20 as twenty)
) 
where order_id &gt; 50006 
connect by ten = order_id
group by ten
order by 1;

```|当外层带有另外的group by时会生成额外的table及viewScan,![](https://pingcode.yasdb.com/atlas/files/public/67396c4ea1ad9a3311dc897b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0),![](https://pingcode.yasdb.com/atlas/files/public/67396c4e8970c2af4f520b0b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0),  
,![](https://pingcode.yasdb.com/atlas/files/public/67396c4e8970c2af4f520b0c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0)|
|CTE|```
with table1 as
( select customer_ref, product_id from orders)
select * from table1
pivot
(
    count(product_id)
    for product_id in(10, 20, 30)
);

```|![](https://pingcode.yasdb.com/atlas/files/public/67396c4e8970c2af4f520b0d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0)|
|多表join|```
--1.表示对orders进行转置
SELECT * FROM orders PIVOT (count(product_id) FOR product_id IN (10 as ten, 20 as twenty));

--2.表示对orders的转置join lineitem的转置
SELECT * FROM orders PIVOT (count(product_id) FOR product_id IN (10 as ten, 20 as twenty)) p1 join lineitem PIVOT (count(l_orderkey) FOR l_orderkey in (50001, 50002)) p2 on p1.ten != 1;

--3.表示对orders和lineitem join的结果进行转置
SELECT * FROM (orders inner join lineitem on 1 = 1) PIVOT (count(product_id) FOR product_id IN (10 as ten, 20 as twenty));

--4.表示对对lineitem进行转置后对orders进行join
SELECT * FROM orders inner join lineitem PIVOT (count(l_orderkey) FOR l_orderkey IN (50001 as ten, 50002 as twenty)) on 1 = 1;

--5.3张表以上
-- 原始join
select * from orders inner join lineitem on 1 = 1 left join supplier on 1 = 1;
-- pivot前两张表的结果
select * from orders inner join lineitem on 1 = 1 pivot (count(product_id) for l_orderkey in (50001, 50002)) left join supplier on 1 = 1;
-- pivot三张表的结果
select * from orders inner join lineitem on 1 = 1 left join supplier on 1 = 1 pivot (count(product_id) for l_orderkey in (50001, 50002)) ;
-- pivot后两张表的结果
select * from orders inner join (lineitem left join supplier on 1 = 1 pivot (count(s_suppkey) for l_orderkey in (50001, 50002))) on 1 = 1;


```|  
|
|语法位置|select * from orders sample(5) seed(1) pivot(count(product_id) for product_id in (50001, 50002));|在sample和flashback之后，alias之前|


**2. 聚合表达式及for**

该部分由于可以看作特殊的group子句，因此聚合列的参数列与for列必须出现在前面查询的投影中

聚合函数允许出现除grouping_id，group_id和grouping这三个与grouping sets相关的函数以外的所有聚合，非聚合函数或不带聚合函数报错

count(1) 等价于 count(for列)

|聚合表达式|SQL|output|
|---|---|---|
|特殊聚合函数,grouping_id等|-|报错,![](https://pingcode.yasdb.com/atlas/files/public/67396c4ea1ad9a3311dc897c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0)|
|带distinct|```
SELECT * FROM
(
  SELECT customer_ref, product_id
  FROM orders
)
PIVOT
(
  count(distinct product_id)
  FOR product_id IN (10, 20)
);

```|正常执行|
|非投影列|-|报错找不到列|


|for列|SQL|output|
|---|---|---|
|投影列|-|-|
|非投影列|-|报错|
|复杂表达式列|```
with table1 as
( select customer_ref, product_id from orders)
select * from table1
pivot
(
    count(product_id)
    for table1.product_id in(10, 20, 30)
);

```|![](https://pingcode.yasdb.com/atlas/files/public/67396c4e8970c2af4f520b0f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0),报错，此处进行严格列名校验，只允许单个长度的列名或别名，禁止复合表达式。,允许列名带括号的场景。,  
|


  


|in列|SQL|output|
|---|---|---|
|常量list|in (1, 2, 3)|-|
|可被静态优化的表达式|in (abs(-10), sqrt(400), length(lpad('a', 30, 'b')))|正常输出|
|列|in (column_name)|报错,Error at line 7    
  ORA-56901: 不允许将非常量表达式用于 pivot|unpivot 值|
|绑定参数|```
set serveroutput on
declare
  param1 int;
  param2 int;
begin
  param1 := 10;
  param2 := 20;
  execute immediate 'SELECT * FROM
(
  SELECT customer_ref, product_id
  FROM orders
)
PIVOT
(
  COUNT(product_id)
  FOR product_id IN (:1, :2)
)' using param1, param2;
end;
/

```|![](https://pingcode.yasdb.com/atlas/files/public/67396c4e8970c2af4f520b10/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0),报错不支持绑定参数|


  


pivot_projection：指经过pivot运算得到的aggr_alias与for_alias的笛卡尔积

|pivot proj |SQL|output|
|---|---|---|
|单聚合,聚合无别名,for列无别名|  
,```
SELECT "10" FROM
(
  SELECT customer_ref, product_id
  FROM orders
)
PIVOT
(
  COUNT(product_id)
  FOR product_id IN (10, 20)
);

```|![](https://pingcode.yasdb.com/atlas/files/public/67396c4e8970c2af4f520b11/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0),以常量列直接作为了外部列名|
|单聚合,聚合无别名,for列别名|```
SELECT col1 FROM
(
  SELECT customer_ref, product_id
  FROM orders
)
PIVOT
(
  COUNT(product_id)
  FOR product_id IN (10 as col1, 20 as col2)
);

```|![](https://pingcode.yasdb.com/atlas/files/public/67396c4f8970c2af4f520b12/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0),投影列可以使用for列别名，因此需要先校验pivot内才能校验外部select列投影|
|单聚合,聚合别名,for列无别名|```
SELECT "10_A" FROM
(
  SELECT customer_ref, product_id
  FROM orders
)
PIVOT
(
  COUNT(product_id) a
  FOR product_id IN (10, 20)
);

```|![](https://pingcode.yasdb.com/atlas/files/public/67396c4f8970c2af4f520b14/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFHQUFBUUdBQUF3QkJBQVNnZ1FnQkFBQUFBSEFnQUFFb0FBQUFBQUJRQ0FBRUVDQUFnQUVBQUVBRkFnQkFBZ0FBQUFBQUFBRUFBQUlFQUNBQ2hBQUFCRUFnZ0FBQWdDQUNBa2dBaUFDQUFBQUJBQUFBQUFBQkFBQkdBSUFBZ0lBQWdBQUFBQUFLZ0FBSUFnQUFBQVFBQUJCQUFpUVlBQUFoQUNFQUFBZ0FFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIzMzgsImV4cCI6MTc4MjMxMzEzOH0.x6pkBYXAuYKFBapSNmWuBVDjnkSHJe2k9GgxlpeS4w0),最终列名为：,常量别名_聚合别名,的形式|


  


XML：本次不支持

**3. 关于投影列与pivot内表达式的关系**

|场景|SQL|output|
|---|---|---|
|投影列包含pivot聚合函数参数列|```
SELECT order_id, customer_ref, quantity
  FROM orders
PIVOT
(
  COUNT(quantity)
  FOR product_id IN (10, 20)
);

```|报错找不到quantity|
|投影列包含for列|```
SELECT order_id, customer_ref, product_id
  FROM orders
PIVOT
(
  COUNT(quantity)
  FOR product_id IN (10, 20)
);

```|报错找不到product_id|


对于一个包含pivot的语句，直接与pivot接触的select只能使用原始表减去pivot用掉的列再加上pivot提供的特殊聚合，所以我认为在语法上，pivot当成一个特殊的groupby操作，而在实现上需要将其认为是一个特殊的，类似from子查询的表，经过了pivot之后，外层只能看到pivot所提供的列

  


## Attachments:

[image2023-11-22_12-5-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGRhMWFkOWEzMzExZGM4OTViIiwicmVmX2lkIjoiNjczOTZjNGQ1OTNmOTljOWZmMjM2Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyMzM4LCJleHAiOjE3ODIzODg3Mzh9.Ttf6a6OOlwL0LrksKwSxzyuwOSqMaw80QzZPgXQNdNo)

 (image/png)    


[image2023-11-22_14-53-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGQ4OTcwYzJhZjRmNTIwYWVlIiwicmVmX2lkIjoiNjczOTZjNGQ1OTNmOTljOWZmMjM2Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyMzM4LCJleHAiOjE3ODIzODg3Mzh9.oGPpgSKH6Cit_83q4RdQ1jIjkyvD9EGRadQHV3--1Ns)

 (image/png)    


[image2023-11-22_14-58-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGRhMWFkOWEzMzExZGM4OTVlIiwicmVmX2lkIjoiNjczOTZjNGQ1OTNmOTljOWZmMjM2Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyMzM4LCJleHAiOjE3ODIzODg3Mzh9.U-uY1lBNI8WOfBwTSE37iILJR4EM9wwy6-P4dq6xklI)

 (image/png)    


[image2023-11-22_15-51-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGQ4OTcwYzJhZjRmNTIwYWY0IiwicmVmX2lkIjoiNjczOTZjNGQ1OTNmOTljOWZmMjM2Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyMzM4LCJleHAiOjE3ODIzODg3Mzh9.1jrA6Iff7NTlneG7gqulCmchwFHHEfPF3ZpzAT4FO3E)

 (image/png)    


[image2023-11-22_17-19-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGQ4OTcwYzJhZjRmNTIwYWY5IiwicmVmX2lkIjoiNjczOTZjNGQ1OTNmOTljOWZmMjM2Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyMzM4LCJleHAiOjE3ODIzODg3Mzh9.dvqGlRBVQvEXuikEzezfEayTMTStHtxr6KFjY2-MLb0)

 (image/png)    


[image2023-11-22_22-31-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGVhMWFkOWEzMzExZGM4OTZkIiwicmVmX2lkIjoiNjczOTZjNGQ1OTNmOTljOWZmMjM2Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyMzM4LCJleHAiOjE3ODIzODg3Mzh9.-sm7IxmwoUIBXlUXD2kwO5z7PRthXEHghf4G9sMfSdI)

 (image/png)    
