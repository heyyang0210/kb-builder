Created by 王泽凯, last modified by  陈关羽 on 十一月 15, 2023

#   [YDBRD-21710 : Having filter下推方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=95096760#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：    [YDBRD-20438](https://jira.yasdb.com/browse/YDBRD-20438?src=confmacro)    -  支持FILTER优化规则  完成

SR链接：    [YDBRD-21710](https://jira.yasdb.com/browse/YDBRD-21710?src=confmacro)    -  Having Filter优化  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#1-overview%E6%A6%82%E8%BF%B0)  

当前对于不存在group by，但是select里面存在aggr的语句。如果有having条件，having内如果为聚集无关的filter，并且能够保证执行的结果正确。如：sysdate之类的内置函数，在aggregate层也保留一个filter的同时，可以下推到aggregate算子下层。

同时，对于存在group by的having条件，如果存在可以下推的filter，也需要推导到group算子下层（现rewrite和verify已经实现，但仍然存在问题，新的逻辑需要把这aggrhaving和grouphaving两种统一在一个函数里）。

这两种下推还存在是否删除原有filter的区别，在详细设计讨论。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

在合适条件下，Aggregate下层添加一个result节点。需要注意的是下推的条件，详见详细设计。

![](https://pingcode.yasdb.com/atlas/files/public/67396c0d8970c2af4f5208f4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFoQUFBZ0FBQUFJSUFBQUFBQVVBQUFBZ0FBQUFBQWdBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg4MjEsImV4cCI6MTc4MjMwOTYyMX0.WTZvcRjXKOe11mtYMtZR18pZ6AN3AIOL4yuoBXdybvE)

修复group by having filter下推中的错误（下图中的result内的条件应该放到group上）。

![](https://pingcode.yasdb.com/atlas/files/public/67396c0da1ad9a3311dc8762/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFoQUFBZ0FBQUFJSUFBQUFBQVVBQUFBZ0FBQUFBQWdBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg4MjEsImV4cCI6MTc4MjMwOTYyMX0.WTZvcRjXKOe11mtYMtZR18pZ6AN3AIOL4yuoBXdybvE)

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#3-interfaces%E6%8E%A5%E5%8F%A3)  

无对外接口。

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

当前方案会下推到aggregate或者group的下一层提出一个result。但因为当前result在执行层的预执行并没有做result的预执行，因此优化的并不够彻底，还存在性能优化空间。后续需要和执行对齐未来result预执行支持相关特性。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#51-architecture%E6%9E%B6%E6%9E%84)  

此处详细说明需要下推的各种情况以及保留filter的原因。

**1. 为什么下推时需要在aggregate层保留一份filter**

- 在进行aggregate的时候，对于select count(*) from test having sysdate < '1990-01-10'; 来说，如果having内条件是恒false，那么在过滤完后，结果集会是空集（注意不是null）。这时候打印出来的内容如下所示。
- 但如果仅仅把filter推下去，对于select count(*) from test where sysdate < '1990-01-10'; 来说，如果where内条件是恒false，那么在过滤完后，结果集会是0。这时候打印出来的内容如下所示。
- 这是因为having相当于把整个抽象group给直接过滤没了，因此没有任何一个结果集可以打印出来。而where条件不是，where是把group内的结果给过滤完了，及时group内结果是0条，但仍然是有group的，这时count出来就是0条，而不是空集。
- 因此在实现的时候，如果下推了filter，仍然需要在aggregate层保留一个原来的filter，保证过滤出来的条件和不下推时的结果一致。


```
SQL> select count(*) from test having sysdate < '1990-01-10';

             COUNT(*)
---------------------

0 rows fetched.
```

```
SQL> select count(*) from test where sysdate < '1990-01-10';

             COUNT(*)
---------------------
                    0

1 row fetched.
```

```
SQL> select count(*) from test where sysdate < '1990-01-10' having sysdate < '1990-01-10';

             COUNT(*)
---------------------

0 rows fetched.
```

**2. 为什么下推时不需要在group层保留一份filter**

- 和aggregate一样，在进行group的时候，对于select count(*) from test group by c1 having sysdate < '1990-01-10'; 来说，如果having内条件是恒false，那么在过滤完后，结果集会是空集（注意不是null）。这时候打印出来的内容如下所示。
- 不同于aggregate，把filter推下去，对于select count(*) from test where sysdate < '1990-01-10' group by c1; 来说，如果where内条件是恒false，那么在过滤完后，结果集会是空集（注意不是null）。这时候打印出来的内容如下所示。
- 这是因为group by在某种程度也做了对group过滤的操作。不同于只有aggr时，在having前会把全部数据（即使数据是0条）当作一个group，having后才做了group相关的过滤操作。在存在groupby时，会在where操作后，再进行group by操作，这时因为没有数据，所以不会生成任何一个group。这时也就是所谓相当于group by也做了一个对group的过滤操作。本质上和having过滤group的操作是一样的。
- 因此对于存在group by的having filter，并不需要在group by层再保留一个filter，如果是恒false，group by天然就不会生成任何一个group，也就和having再过滤效果一致了。


```
SQL> select count(*) from test group by c1 having sysdate < '1990-01-10';

             COUNT(*)
---------------------

0 rows fetched.
```

```
SQL> select count(*) from test where sysdate < '1990-01-10' group by c1;

             COUNT(*)
---------------------

0 rows fetched.
```

  


**3. 可下推的filter**

目前已知的可以下推的filter：

1. group by时的group by列相关filter，包括group by列的加减乘除
1. 和列完全无关并且不随机的函数，如sysdate


下面罗列可下推属性，T表示可推，F表示不可退（如果havingFilter中最小拆分条件中含有任何不可下推的属性皆不可推。另外，在各数据库中其具体体现见    [having Filter调研](https://conf.yasdb.com/pages/viewpage.action?pageId=133572302)    ）：

|having子句中的属性及简单介绍|有group|无group|
|---|---|---|
|包含在group by子句中的属性列（可做四则运算、作为可下推内置函数中的参数）|T|语法错误|
|聚集函数|F|F|
|窗口函数|F|F|
|SYSDATE|T|T|
|SYSTIMESTAMP|T|T|
|NULL|T|T|
|ROWNUM|F|语法错误|
|USER|T|T|
|ROWSCN|语法错误|语法错误|
|ABS、|T|T|
|- [x] ACOS、   |T|T|
|- [x] ADD_MONTHS   |T|T|
|- [x] AGE   |T|T|
|- [x] ASIN、   |T|T|
|- [x] ATAN、   |T|T|
|- [x] ATAN2、   |T|T|
|- [ ] AVG、   |F|F|
|- [x] CEIL/CEILING、   |T|T|
|- [x] COS、   |T|T|
|- [x] COT、   |T|T|
|- [x] DIV、   |T|T|
|- [x] FLOOR、   |T|T|
|- [x] MOD、   |T|T|
|- [x] PI、   |T|T,静态优化|
|- [x] POW/POWER、   |T|T|
|- [ ] RANDOM/RAND、   |F|F|
|- [x] SIGN、   |T|T|
|- [x] SIN、   |T|T|
|- [x] SQRT、   |T|T|
|- [x] TAN、   |T|T|
|- [x] TRUNCATE/TRUNC   |T|T|
|- [x] ASCII、   |T|T|
|- [x] BIT_LENGTH、   |T|T|
|- [x] CHR  /  CHALEASTR 、   |T|T|
|- [x] CHAR_LENGTH  /  CHARACTER_LENGTH、   |T|T|
|- [x] CONCAT、   |T|T,静态优化|
|- [x] CONCAT_WS、   |T|T|
|- [x] FIND_IN_SET、   |T|T|
|- [ ] GROUP_CONCAT、   |F|F|
|- [x] INSTR、   |T|T|
|- [x]    LCASE  /  LOWER、   |T|T,静态优化|
|- [x]    LEFT、   |T|T,静态优化|
|- [x] LENGTH、   |T|T|
|- [x] LPAD、   |T|T,静态优化|
|- [x] LTRIM、   |T|T|
|- [x] POSITION、   |T|T|
|- [x] OCTET_LENGTH、   |T|T|
|- [x] RIGHT、   |T|T|
|- [x] RPAD、   |T|T|
|- [x] RTRIM、   |T|T|
|- [x] REPLACE、   |T|T|
|- [x] SUBSTR、   |T|T,静态优化|
|- [x] SUBSTRING、   |T|T,静态优化|
|- [x] SUBSTRING_INDEX、   |T|T|
|- [x] TRIM、   |T|T|
|- [x] UCASE  /  UPPER   |T|T|
|- [x] REGEXP_LIKE、   |T|T|
|- [x] REGEXP_REPLACE、   |T|T|
|- [x] REGEXP_INSTR、   |T|T|
|- [x] REGEXP_SUBSTR   |T|T|
|- [x] BIN   |T|T|
|- [x] CAST   |T|T|
|- [x] CURRENT_TIMESTAMP、   |T|T|
|- [x] DATE、   |T|T|
|- [x] DAYOFWEEK、   |T|T|
|- [x] DATE_FORMAT、   |T|T|
|- [x] DATE_ADD、   |T|T|
|- [x] EXTRACT、   |T|T|
|- [x] LAST_DAY、   |T|T|
|- [x] LOCALTIMESTAMP、   |T|T|
|- [x] NOW、   |T|T|
|- [x] SYSDATE、   |T|T|
|- [x] TIME、   |T|T|
|- [x] TIMESTAMP、   |T|T|
|- [x] TIMEDIFF、   |T|T|
|- [x] TIMESTAMPDIFF、   |T|T|
|- [x] UTC_TIMESTAMP   |T|T|
|- [x] JSON  、(NULL)   |T|T|
|- [x] JSON_ARRAY_GET、(NULL)   |T|T|
|- [x] JSON_ARRAY_LENGTH、   |T|T|
|- [x] JSON_EXISTS、   |T|T|
|- [x] JSON_FORMAT、(NULL)   |T|T|
|- [x] JSON_PARSE、(NULL)   |T|T|
|- [x] JSON_QUERY、(NULL)   |T|T|
|- [x] JSON_SERIALIZE (NULL)   |T|T|
|- [x] BITAND  /  BIT_AND、   |T|T|
|- [x]    BITOR  /  BIT_OR、   |T|T|
|- [x] BITXOR  /  BIT_XOR、   |T|T|
|- [x] COALESCE、   |T|T|
|- [x] ISNULL、   |T|T|
|- [x] GREATEST、   |T|T|
|- [x] LEAST   |T|T|
|- [ ] SYS_GUID   |F|F|
|- [ ] SAMPLE   |F|F|
|- [ ] STDDEV_PHASE2   |F|F|
|- [ ] STDDEV_POP_PHASE2   |F|F|
|- [ ] STDDEV_SAMP_PHASE2   |F|F|
|- [x] SYS_CONNECT_BY_PATH   |T|T|
|- [ ] VARIANCE_PHASE2   |F|F|
|- [ ] VAR_POP_PHASE2   |F|F|
|- [ ] VAR_SAMP_PHASE2   |F|F|


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

  


![](https://pingcode.yasdb.com/atlas/files/public/67396c0d8970c2af4f5208f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFoQUFBZ0FBQUFJSUFBQUFBQVVBQUFBZ0FBQUFBQWdBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg4MjEsImV4cCI6MTc4MjMwOTYyMX0.WTZvcRjXKOe11mtYMtZR18pZ6AN3AIOL4yuoBXdybvE)

  


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

无。

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#54-dfx%E8%AE%BE%E8%AE%A1)  

无。

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#55-%E5%85%B6%E4%BB%96)  

无。

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

```
drop table if exists table_hFilter;
drop table if exists table_hFilter_02;
create table table_hFilter (C01 int, C02 char(33));
create table table_hFilter_02 (C01 int, C02 char(33));
insert into table_hFilter values(101, '2000');
insert into table_hFilter values(102, '2000');
insert into table_hFilter values(103, '2001');
insert into table_hFilter values(104, '2005');
insert into table_hFilter values(105, '2000');
insert into table_hFilter values(106, '2000');
insert into table_hFilter values(107, '2005');
insert into table_hFilter values(108, '2001');
insert into table_hFilter values(109, '2009');
insert into table_hFilter values(110, '2009');
insert into table_hFilter values(111, null);
insert into table_hFilter_02 values(107, '2005');
insert into table_hFilter_02 values(108, '2001');
insert into table_hFilter_02 values(109, '2009');
insert into table_hFilter_02 values(110, '2009');
commit;

-- group expr
explain select C01, C02 from table_hFilter group by C01, C02 having C01 <= 104;
select C01, C02 from table_hFilter group by C01, C02 having C01 <= 104;

-- subquery
explain select C01 from table_hFilter t1 group by C01 having C01 in (select C01 from table_hFilter_02 t2 where t2.C01 = t1.C01 group by C01);
select C01 from table_hFilter t1 group by C01 having C01 in (select C01 from table_hFilter_02 t2 where t2.C01 = t1.C01 group by C01);

explain select C01 from table_hFilter t1 group by C01 having C01 in (select C01 from table_hFilter_02 t2 group by C01);
select C01 from table_hFilter t1 group by C01 having C01 in (select C01 from table_hFilter_02 t2 group by C01);

explain select * from (select count(1) C01 from table_hFilter) aa where aa.C01 < 1 and exists (select 1 from table_hFilter_02);
select * from (select count(1) C01 from table_hFilter) aa where aa.C01 < 1 and exists (select 1 from table_hFilter_02);

explain select * from (select count(1) C01 from table_hFilter) aa having exists (select 1 from table_hFilter_02);
select * from (select count(1) C01 from table_hFilter) aa having exists (select 1 from table_hFilter_02);

-- user
explain select C01, C02 from table_hFilter group by C01, C02 having user = 'SYS' and C01 > 104;
select C01, C02 from table_hFilter group by C01, C02 having user = 'SYS' and C01 > 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having user = 'SYS';
select COUNT(C01), AVG(C02) from table_hFilter having user = 'SYS';

-- ROWID
explain select C01, C02 from table_hFilter group by C01, C02, ROWID having ROWID = '2368:0:0:3868:0';
select C01, C02 from table_hFilter group by C01, C02, ROWID having ROWID = '2368:0:0:3868:0';
explain select COUNT(C01), AVG(C02) from table_hFilter having ROWID = '2368:0:0:3868:0';
select COUNT(C01), AVG(C02) from table_hFilter having ROWID = '2368:0:0:3868:0';

--ROWSCN
explain select C01, C02 from table_hFilter group by C01, C02, ROWSCN having ROWSCN = '1';
select C01, C02 from table_hFilter group by C01, C02, ROWSCN having ROWSCN = '1';
explain select COUNT(C01), AVG(C02) from table_hFilter having ROWSCN = '1';
select COUNT(C01), AVG(C02) from table_hFilter having ROWSCN = '1';

--ROWNUM
explain select C01, C02 from table_hFilter group by C01, C02, ROWNUM having ROWNUM < 2;
select C01, C02 from table_hFilter group by C01, C02, ROWNUM having ROWNUM < 2;
explain select COUNT(C01), AVG(C02) from table_hFilter having ROWNUM < 2;
select COUNT(C01), AVG(C02) from table_hFilter having ROWNUM < 2;

-- udf
create or replace function f1 return int is
begin
return 100;
end;
/
explain select C01, C02 from table_hFilter group by C01, C02 having f1 < 100 AND C01 <= 104;
select C01, C02 from table_hFilter group by C01, C02 having f1 < 100 AND C01 <= 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having f1 < 100;
select COUNT(C01), AVG(C02) from table_hFilter having f1 < 100;

-- sysdate
explain select C01, C02 from table_hFilter group by C01, C02 having sysdate = '2023-10-23' AND C01 <= 104;
select C01, C02 from table_hFilter group by C01, C02 having sysdate = '2023-10-23' AND C01 <= 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having sysdate = '2023-10-23';
select COUNT(C01), AVG(C02) from table_hFilter having sysdate = '2023-10-23';

-- NULL
explain select C01, C02 from table_hFilter group by C01, C02 having NULL = ' ' AND C01 <= 104;
select C01, C02 from table_hFilter group by C01, C02 having NULL = ' ' AND C01 <= 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having NULL = ' ';
select COUNT(C01), AVG(C02) from table_hFilter having NULL = ' ';

-- SYSTIMESTAMP
explain select C01, C02 from table_hFilter group by C01, C02 having SYSTIMESTAMP > '2023-10-22' AND C01 <= 104;
select C01, C02 from table_hFilter group by C01, C02 having SYSTIMESTAMP > '2023-10-22' AND C01 <= 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having SYSTIMESTAMP < '2023-10-23';
select COUNT(C01), AVG(C02) from table_hFilter having SYSTIMESTAMP < '2023-10-23';

-- MATH FUNC
explain select C01, C02 from table_hFilter group by C01, C02 having ABS(C01) > 125 AND AVG(C01) <= 104;
select C01, C02 from table_hFilter group by C01, C02 having ABS(C01) > 125 AND AVG(C01) <= 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having ABS(RANDOM()) > 125 AND AVG(C01) <= 104;
select COUNT(C01), AVG(C02) from table_hFilter having ABS(RANDOM()) > 125 AND AVG(C01) <= 104;

-- STR FUNC
explain select C01, C02 from table_hFilter group by C01, C02 having GROUP_CONCAT(C01) IS NOT NULL AND C01 <= 104;
select C01, C02 from table_hFilter group by C01, C02 having GROUP_CONCAT(C01) IS NOT NULL AND C01 <= 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having GROUP_CONCAT(C01) IS NOT NULL;
select COUNT(C01), AVG(C02) from table_hFilter having GROUP_CONCAT(C01) IS NOT NULL;

-- PLUGIN FUNC
explain select C01, C02 from table_hFilter group by C01, C02 having REGEXP_LIKE(C02, '2001', 'i') AND C01 <= 104;
select C01, C02 from table_hFilter group by C01, C02 having REGEXP_LIKE(C02, '2001', 'i') AND C01 <= 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having REGEXP_LIKE(sysdate, '2023-11-13', 'i');
select COUNT(C01), AVG(C02) from table_hFilter having REGEXP_LIKE(sysdate, '2023-11-13', 'i');

-- TIME FUNC
explain select C01, C02 from table_hFilter group by C01, C02 having CURRENT_TIMESTAMP > '2023-11-13' AND avg(C01) <= 104;
select C01, C02 from table_hFilter group by C01, C02 having CURRENT_TIMESTAMP > '2023-11-13' AND avg(C01) <= 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having CURRENT_TIMESTAMP > '2023-11-13';
select COUNT(C01), AVG(C02) from table_hFilter having CURRENT_TIMESTAMP > '2023-11-13';
explain select avg(C01) from table_hFilter having TIME(MAX(SYSDATE)) < '2021';
select avg(C01) from table_hFilter having TIME(MAX(SYSDATE)) < '2021';
explain select avg(C01) from table_hFilter having TIME(SYSDATE) < '2021';
select avg(C01) from table_hFilter having TIME(SYSDATE) < '2021';

-- JSON
explain select COUNT(C01), AVG(C02) from table_hFilter having JSON(NULL) IS NOT NULL;
select COUNT(C01), AVG(C02) from table_hFilter having JSON(NULL) IS NOT NULL;

-- SYS_GUID
explain select C01, C02 from table_hFilter group by C01, C02 having cast(SYS_GUID() as varchar) = 'dd' AND C01 <= 104;
select C01, C02 from table_hFilter group by C01, C02 having cast(SYS_GUID() as varchar) = 'dd' AND C01 <= 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having cast(SYS_GUID() as varchar) = 'dd';
select COUNT(C01), AVG(C02) from table_hFilter having cast(SYS_GUID() as varchar) = 'dd';

explain select C01, C02 from table_hFilter group by C01, C02 having cast(SYS_GUID() as varchar) = 'dd' AND C01 <= 104;
select C01, C02 from table_hFilter group by C01, C02 having cast(SYS_GUID() as varchar) = 'dd' AND C01 <= 104;
explain select COUNT(C01), AVG(C02) from table_hFilter having cast(SYS_GUID() as varchar) = 'dd';
select COUNT(C01), AVG(C02) from table_hFilter having cast(SYS_GUID() as varchar) = 'dd';
```

  


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=133579109#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

后续需要和执行对齐未来result预执行相关特性。

## Attachments:

[image2023-11-6_9-34-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGNhMWFkOWEzMzExZGM4NzU5IiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.a_tsSkU4rkPnii9JqKjIStE0kGRuyzm8hgfwHh7aDWY)

 (image/png)    


[image2023-11-7_9-24-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGQ4OTcwYzJhZjRmNTIwOGVhIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.yhB0SgalknsYZK92GVdnWaBE6Vpu4Y6mD2mf5uovw5E)

 (image/png)    


[image2023-11-7_9-24-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGRhMWFkOWEzMzExZGM4NzVhIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.dxJLNaHIE2_0a8s22yYNC956eO6O7FEOHdUxdjTyy-w)

 (image/png)    


[image2023-11-7_10-43-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGRhMWFkOWEzMzExZGM4NzViIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.mIqJeGrNDbfr7dQbBZNVVUP5a1yWfMDe59WstIoBZHU)

 (image/png)    


[image2023-11-7_10-43-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGQ4OTcwYzJhZjRmNTIwOGVjIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.NLO0y8JkNiPCQygGJphCFmIXzxzTumSIram1E-22I_4)

 (image/png)    


[image2023-11-7_11-17-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGQ4OTcwYzJhZjRmNTIwOGVlIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.0ZteudFiXcGAyu_8yvSWM-PXnCrk0_hU3XWdPokX5ik)

 (image/png)    


[image2023-11-7_11-38-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGRhMWFkOWEzMzExZGM4NzVlIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.cvwarVRUuRFrpC_sucbgEic4G_t1Qiz3n0dipTEyoH8)

 (image/png)    


[image2023-11-7_11-42-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGQ4OTcwYzJhZjRmNTIwOGYwIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.oXhpriYcKcIJkZ0Ix_MsDcUst0h9zsydpMj1baH2Qkg)

 (image/png)    


[image2023-11-7_17-16-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGRhMWFkOWEzMzExZGM4NzVmIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.Oqe1UzyNXhJInX5drEwd2QszUEsUHDiOFzblCHe4RU0)

 (image/png)    


[image2023-11-7_15-3-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGRhMWFkOWEzMzExZGM4NzYwIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.6SCWLD60uE8SyV_bF4m2_v2X6Kuqzet1LdvFQu53hrE)

 (image/png)    


[image2023-11-7_15-4-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGQ4OTcwYzJhZjRmNTIwOGYyIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.PDDi_wI_S2T9_OPquWnsTmXDH4g34zdaFlceegCxsH4)

 (image/png)    


[image2023-11-7_16-51-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGQ4OTcwYzJhZjRmNTIwOGYzIiwicmVmX2lkIjoiNjczOTZjMGM1OTNmOTljOWZmMjM2OWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODIxLCJleHAiOjE3ODIzODUyMjF9.Qi8l9dUhROq5VvJuMQ9pTpjy6etODGTilZtRZ32ApeE)

 (image/png)    
