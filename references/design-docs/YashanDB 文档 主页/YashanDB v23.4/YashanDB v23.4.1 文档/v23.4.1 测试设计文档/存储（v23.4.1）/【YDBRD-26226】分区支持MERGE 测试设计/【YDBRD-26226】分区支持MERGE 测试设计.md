Created by 陈瑞, last modified by  任艳芬 on 十一月 15, 2024

# 1、概述

支持一级分区，二级分区的merge

  [https://pingcode.yasdb.com/pjm/items/6618f7d9fd997db58ad8610d](https://pingcode.yasdb.com/pjm/items/6618f7d9fd997db58ad8610d)    ?    
  #YDBRD-26226 分区支持MERGE

需求范围

1、交付形态：  单机(集群适配)

~~2、行列表都需要支持  只支持行表~~

3、包含RANGE、LIST分区

# 2. 需求分析

## 2.1 功能点分析

### 1.1 oracle语法

- 将多个分区合并为一个分区，只能merge range或者 list分区：
    - range/interval: 合并的分区必须是连续的，将最大的partition bound做为合并之后新分区的bound
    - list: 可以合并任意分区
    - 二级分区合并一级分区
    - 二级分区合并二级分区  --必须在同一个一级分区


  


![](https://pingcode.yasdb.com/atlas/files/public/67396f058970c2af4f521d1c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQmdBQUVBQUFBQVFBQUFBQUFBQWdBQUFDQUFBQUFBQUVBQUFBQUFBQ0FBQUFBQUFRQUFBQUFBQWdBQUFBZ0FBQUFBQUlBQUFBQUFBQUFBQ0JBQUFBQUFBQVFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBRUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg5OTcsImV4cCI6MTc4MjQ2OTc5N30.kGhUfViENG1q5X4SZGT9y0vf2THBmIUBYMTUQereNAY)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396f05a1ad9a3311dc9b8d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQmdBQUVBQUFBQVFBQUFBQUFBQWdBQUFDQUFBQUFBQUVBQUFBQUFBQ0FBQUFBQUFRQUFBQUFBQWdBQUFBZ0FBQUFBQUlBQUFBQUFBQUFBQ0JBQUFBQUFBQVFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBRUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg5OTcsImV4cCI6MTc4MjQ2OTc5N30.kGhUfViENG1q5X4SZGT9y0vf2THBmIUBYMTUQereNAY)

#### 1.4 只做  update_index_clauses   

![](https://pingcode.yasdb.com/atlas/files/public/67396f058970c2af4f521d1d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQmdBQUVBQUFBQVFBQUFBQUFBQWdBQUFDQUFBQUFBQUVBQUFBQUFBQ0FBQUFBQUFRQUFBQUFBQWdBQUFBZ0FBQUFBQUlBQUFBQUFBQUFBQ0JBQUFBQUFBQVFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBRUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg5OTcsImV4cCI6MTc4MjQ2OTc5N30.kGhUfViENG1q5X4SZGT9y0vf2THBmIUBYMTUQereNAY)

**无数据不失效索引，分区有数据有以下情况**

####   1)、split 

- yashan:  update global indexes为语法兼容，全局索引是一定失效的。update indexes时不会失效local索引但会失效global 索引。   不支持 INVALIDATE 字段
- oracle：update global indexes/update indexes 不失效全局索引，一定失效分区索引


####   2)、merge：

- oracle：update global indexes/update indexes 不失效全局索引，一定失效分区索引
- yashan： update global indexes为语法兼容，全局索引是一定失效的。update indexes时不会失效local索引但会失效global 索引。   不支持 INVALIDATE 字段


  


#### 1.5  支持表分区的描述信息。

oracle和yashan目前支持的不一样。以yashan 的split功能对齐，应该支持以下内容，包括segment creation

  


![](https://pingcode.yasdb.com/atlas/files/public/67396f05a1ad9a3311dc9b8f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQmdBQUVBQUFBQVFBQUFBQUFBQWdBQUFDQUFBQUFBQUVBQUFBQUFBQ0FBQUFBQUFRQUFBQUFBQWdBQUFBZ0FBQUFBQUlBQUFBQUFBQUFBQ0JBQUFBQUFBQVFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBRUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg5OTcsImV4cCI6MTc4MjQ2OTc5N30.kGhUfViENG1q5X4SZGT9y0vf2THBmIUBYMTUQereNAY)

### 2.2 应用场景

- 合并 range(interval)或者 list分区。
- 合并 二级分区是range或者 list分区的分区
- 合并 二级分区的一级分区是range或者 list分区的分区


### 2.3 规格约束

- range/interval: 合并的分区必须是连续的，将最大的partition bound做为合并之后新分区的bound
- list: 可以合并任意分区
- partName和partKey不能混合使用。即不允许alter table t_partition_rangemerge partitions p1, for(19) into partition p2;  
- 二级分区需要合并的子分区必须属于同一个分区。
- range分区支持 p1 to p3语法，p1, p2,p3 bound必须递增
- update global indexes为语法兼容，全局索引是一定失效的。update indexes时不会失效local索引，oracle会失效local索引。   --和oracle保持差异，和yashan 的split功能对齐
- 结果分区如果没有指定属性，如tablespace，segment creation，都继承父分区的属性，如果复用了原分区，则继承原分区属性。
- partition spec中table_partition_description支持tablespace,     PCTFREE/PCTUSED/INITRANS/MAXTRANS等属性
- subpartition clause只支持tablespace, compression？
- 支持单机，集群
- 不支持LSC


# 3. 详细测试设计

## 3.1 测试设计方法

### 1、  **语法及merge规则校验。**

对于约束规格中异常场景，四种合并语法在分区定位阶段的异常验证

### 2、元数据变更，数据迁移 主要功能 

**2.1  表类型和合并语法交叉覆盖，非正交覆盖**

交叉覆盖：考虑不同合并语法只在  分区定位，merge规则校验不同，底层元数据修改和数据迁移处理是相同的。

A.p1 to pn   

B.p1,p2...pn 

C.for (value),for(value)

D.for (value),for(value)

  


**2.2 表类型和场景正交组合**

涉及分区元数据的观察

A. 对于range分区，结果分区总是使用bound最大的分区  part#, partBound  ， 对于interval分区，

B.对于list分区,结果分区是新分区--使用最后一个分区  part#;结果分区是旧分区--使用旧分区part#

C. 对于interval分区，取决于原分区是range还是interval分区；part#与分区属性需要变更。

1. 合并两个interval分区，结果分区以及结果分区之前的分区都转成range分区，part#按照range分区规则重新分配。
1. 合并range分区和interval分区，结果分区为range分区，结果分区part#重新分配，原range分区删去，所以结果分区重新分配的part#与原来range分区一致。


  


**表为一级分区表，合并一级分区 **  -- interval需要观察自动扩展能力

- 一级分区是list  
- 一级分区是range
- 一级分区是interval的range
- 一级分区是interval的range + interval
- 一级分区是interval的interval + interval


**表为二级分区表，合并一级分区**

- 一级分区是list ，二级分区是hash
- 一级分区是list ，二级分区是list
- 一级分区是list ，二级分区是range
- 一级分区是range ，二级分区是hash
- 一级分区是range，二级分区是list
- 一级分区是range，二级分区是range


**表为二级分区表，合并二级分区**

- 一级分区是list ，二级分区是list
- 一级分区是list ，二级分区是range
- 一级分区是range，二级分区是list
- 一级分区是range，二级分区是range
- 一级分区是hash，二级分区是list
- 一级分区是hash，二级分区是range


**2.3 分区的数据分布作为主要场景**

- 设计一级分区 5个分区，其中3个分区参与合并,p1,p2,p3。设计p1，p2，p3分别有数据和无数据，及合并到新分区和旧分区几种情况
- 设计二级分区的一级分区 5个分区，每个一级分区3个二级分区，其中3个二级分区参与合并。设计sp1，sp2，sp3分别有数据和无数据，以及及合并到新分区和旧分区几种情况
- 设计二级分区的一级分区 5个分区，每个一级分区3个二级分区，设计p1，p2，p3个一级分区参与合并。设计九个二级分区部分有数据和无数据。并且结果分区有1，2，3个二级分区的情况
- 验证数据迁移方案是否最优。观察性能。a.大分区数据量远大于小分区。两分区合并时，应该选择复用大分区segment。b.有数据分区和空分区合并时，复用有数据的segment


#### 3、索引和lob加入到每个功能用例中。另外函数索引，RTREE索引，列式索引，udt，约束，AC，嵌套表单独做用例看护

- 包括全局/分区索引，以及使用不同update_index_clauses  语句后，校验索引的可用状态符合预期，rebuild 索引正常。 
- CLOB/BLOB，行外/行内lob，合并后数据准确
- 包括嵌套表在内的UDT。多层嵌套。


#### 4、数据迁移正常。包括元数据和。覆盖到segment是复用、新建、entry三种情况。合并后查询索引分区/表分区/lob分区数据准确

- ~~设计一级分区 5个分区，其中3个分区参与合并,p1,p2,p3。设计p1，p2，p3分别有数据和无数据，及合并到新分区和旧分区几种情况~~
- ~~设计二级分区的一级分区 5个分区，每个一级分区3个二级分区，其中3个二级分区参与合并。设计sp1，sp2，sp3分别有数据和无数据，以及及合并到新分区和旧分区几种情况~~
- ~~设计二级分区的一级分区 5个分区，每个一级分区3个二级分区，设计p1，p2，p3个一级分区参与合并。设计九个二级分区部分有数据和无数据。并且结果分区有1，2，3个二级分区的情况~~
- ~~验证数据迁移方案是否最优。a.大分区数据量远大于小分区。两分区合并时，应该选择复用大分区segment。b.有数据分区和空分区合并时，复用有数据的大分区segment~~


#### 5、表空间与oracle一致

- 覆盖索引/CLOB/BLOB/嵌套表。
- 新分区不指定表空间，跟随表分区所在表空间
- 新分区指定表空间，指定的表空间


#### 6、逻辑备机解析正确。覆盖所有语法

#### 7、分区属性

A.指定分区属性包括SEGMENT CREATION，符合预期；

B.继承分区属性正常，包括索引分区属性的继承符合预期。

  


## 3.2 语法

|场景|有效类|无效类|
|---|---|---|
|**1、缺少/多关键字**|- ALTER TABLE MERGE PARTITION P1,P2,PN INTO PARTITION
- 合并一级分区
,list、range,range-hash、range-list、range-range、list-hash、list-list、list-range,- 合并二级分区
,list-range、range-range、hash-range、list-list、range-list、hash-list|- 缺少merge关键字
- 缺少partitions关键字
- 缺少partition name关键字
- 缺少   ,   
- 缺少into
- 缺少合并后缺少partitions关键字
- for缺少前括号
- for缺少后括号
- update indexes缺少update
- update indexes缺少indexes
- update indexes截断为update index
- update global indexes缺少update
- update global indexes缺少indexes
- update global indexes截断为update global index
- 结果分区数量大于>1
- 指定两个但是前后关键字不对MERGE partitions xxx,xxx into subpartition /  MERGE subpartitions xxx,xxx into partition   --补充场景
|
|  
|ALTER TABLE MERGE PARTITION P1 TO PN INTO PARTITION   
同上|同上,ALTER TABLE MERGE PARTITION P1 TO   P2  ,PN INTO PARTITION,ALTER TABLE MERGE PARTITION P1,  P2  TO   PN INTO PARTITION,ALTER TABLE MERGE PARTITION P1 INTO PARTITION     
    
|
|  
|ALTER TABLE MERGE PARTITION FOR(),FOR() INTO PARTITION     
  同上|同上|
|  
|ALTER TABLE MERGE PARTITION FOR() TO FOR() INTO PARTITION,同上|同上|
|**2、PCTFREE/PCTUSED/INITRANS/MAXTRANS/SEGMENT CREATION DEFERRE/update global index**|- 全量属性
- 不带属性
- 调换顺序
|- PCTFREE/PCTUSED/INITRANS/MAXTRANS 缺少intger值
|
|**3、for（value），for（value），...**,**三种一级分区**,**8种支持的二级分区都覆盖**|- 100分区个数
- 原分区个数上限   
|  
|
|  
|  
|- 原分区名字不存在  
|
|  
|  
|- 原分区名字重复
|
|  
|  
|- 原分区bound从大到小  --range
|
|  
|  
|- 原分区bound不是递增 --range
|
|  
|  
|- for（value）定位的分区不存在
|
|  
|  
|- 结果分区使用for（value）
|
|  
|  
|- for（value），for（value）定位的原分区有重复
|
|  
|  
|- for（value）和 分区名字混合使用
|
|  
|  
|- values值个数与分区键不匹配(一、二级分区/多列分区键)
|
|  
|  
|- values值单独括号包裹(一、二级分区/多列分区键)
|
|  
|  
|- values值与分区键数据类型不匹配
|
|  
|  
|- 要合并的二级分区不在一个一级分区，覆盖六种分区
|
|  
|  
|- 结果分区与未参与合并的分区重名
|
|  
|  
|- 结果分区名是旧分区，但不是最大边界值的分区  --range
|
|**3、for（value）to for（value）**|  
|同上,- list分区使用 to 报错
|
|**4、**  **p1 to pn**|  
|同上,- list分区使用 to 报错
|
|**5、p1,p2,...,pn**|  
|同上|
|**7、不支持的分区合并**,  
|  
|- hash分区
- 合并二级分区
,list - hash,range - hash,hash - hash,- 合并一级分区
,hash-hash,hash-list,hash-range|
|**8、拦截**|  
|- 分布式拦截
- lsc表拦截
|


  


## 3.3 功能

**观察点：**

1、用例都带index和lob。观察点：合并后查询索引分区数据，查询表分区数据是否准确，lob数据准确

2、元数据准确

dba_table_partitions,  dba_ind_partitions,  dba_lob_partitions

dba_table_subpartitions,  dba_ind_subpartitions,  dba_lob_subpartitions

查询    [TABPART$，INDPART$](https://conf.yasdb.com/pages/viewpage.action?pageId=141575182#tabpartindpart)    系统表。part# ,   分区属性

SELECT   tp.obj  #, o.subname, tp.part# FROM tabpart$ tp JOIN obj$ o ON tp.obj# = o.obj# WHERE     [o.name](http://o.name)     = 'SPLIT_RANGE_PART';

  


|序号|用例集|分区类型|语法|测试点|预期|
|---|---|---|---|---|---|
|  
|表为一级分区表,合并一级分区|range|交叉覆盖到,A.p1 to pn ,B.for(value) TO for(value),C.p1,...,pn ,D.for(value) TO for(value),  
|- 有5个分区，其中3个分区参与合并,p1,p2,p3
- 单列分区键
- 多列分区键
- 合并后执行dml业务，跨分区更新，查询系统表。
- 集群在merge和非merge实例执行dml
,数据迁移,1、p1,p2,p3分区都有数据，结果分区指定p3 --全局索引失效，p3索引分区失效,2、p1,p2,p3分区都有数据，结果分区指定新分区p99 --全局索引失效，p3索引分区失效,3、p1,p2,p3分区都有数据，带update indexes    --全局索引失效，p3索引分区不失效,  
,4、p1,p2分区有数据,p3无数据，结果分区指定p3  ,5、p1,p2分区有数据,p3无数据，结果分区指定p99 ,6、p1,p2分区有数据,p3无数据，带update indexes ,  
,7、p1,p3分区有数据,p2无数据，结果分区指定p3,8、p1,p3分区有数据,p2无数据，结果分区指定p99,9、p1,p3分区有数据,p2无数据，带update indexes,  
,10、p1,p2,p3分区无数据，结果分区指定p3  --全局索引不失效，p3索引分区不失效,11、p1,p2,p3分区无数据，结果分区指定p99 --同上,12、p1,p2,p3分区无数据，带update indexes --同上,  
,10-1、delete数据后，p1,p2,p3分区无数据，结果分区指定p3 --全局索引失效，p3索引分区失效,  
,13、p5 bound 是默认值，p1,p5 参与合并，合并分区后还是maxvalue,14、values值分区内覆盖日期，数值，字符数据类型，常量的  表达式|part#为合并前最大边界值的分区|
|  
|  
|list|A,B,C,D|- 有5个分区，其中3个分区参与合并,p1,p2,p3
- 单列分区键
- 多列分区键
- 合并后执行dml业务，跨分区更新，查询系统表。
- 集群在merge和非merge实例执行dml
- 覆盖正常顺序、打乱顺序两种。如 p3, p1, p2 → p4
,数据迁移,21、p1,p2,p3分区都有数据，结果分区指定p3 --全局索引失效，p3索引分区失效,--如 p3, p1, p2 → p3，p3维持原来的part#,--如 p3, p1, p2 → p99，p99使用p2 的part#,22、p1,p2,p3分区都有数据，结果分区指定新分区p99 --全局索引失效，p3索引分区失效,23、p1,p2,p3分区都有数据，带update indexes   --全局索引失效，p3索引分区不失效,  
,24、p1,p2分区有数据,p3无数据，结果分区指定  p2,25、p1,p2分区有数据,p3无数据，结果分区指定p99,26、p1,p2分区有数据,p3无数据，带update indexes,  
,27、p1,p3分区有数据,p2无数据，结果分区指定  p1,28、p1,p3分区有数据,p2无数据，结果分区指定p99,29、p1,p3分区有数据,p2无数据，带update indexes,  
,30、p1,p2,p3分区无数据，结果分区指定p3  --全局索引不失效，p3索引分区不失效,31、p1,p2,p3分区无数据，结果分区指定p99 --同上,32、p1,p2,p3分区无数据，带update indexes --同上,  
,33、p5 bound 是默认值,p5,p1  → p99(default)    ，合并分区后还是default,part#是p5,p1,p5  → p99(default)    ，合并分区后还是default,part#是p5,  
,34、values值分区内合理值，覆盖日期，数值，字符数据类型，表达式|  
|
|  
|  
|interval|A,B,C,D|1~14 同上,15、（range + range ）分区合并,16、（range + interval）分区合并,17、（interval + interval）分区合并|  
,15、不影响分区继续扩展,16、结果分区为range分区，结果分区part#重新分配，原range分区删去。不影响分区继续扩展,17、结果分区以及结果分区之前的分区都转成range分区，part#按照range分区规则重新分配。不影响分区继续扩展|
|  
|表为二级分区,合并一级分区|range-hash,range-list,range-range,  
|A.p1 to pn ,B.for(value) TO for(value),C.p1,...,pn ,D.for(value) TO for(value),交叉覆盖到|- 有5个一级分区，其中3个分区参与合并,p1,p2,p3。每个分区有3个子分区
- 单列分区键
- 多列分区键
- 合并后执行dml业务，跨分区更新，查询系统表
- 集群在merge和非merge实例执行dml
,同range分区表1~14,1、p1,p2,p3分区都有数据，结果分区指定p3 --全局索引失效，p3索引分区失效,- 合并后全部在3个二级分区
- 合并后全部在2个二级分区
- 合并后全部在1个二级分区
,2、p1,p2,p3分区都有数据，结果分区指定新分区p99 --全局索引失效，p3索引分区失效,- 合并后全部在3个二级分区
- 合并后全部在2个二级分区
- 合并后全部在1个二级分区
,3、p1,p2,p3分区都有数据，带update indexes    --全局索引失效，p3索引分区不失效,- 合并后全部在3个二级分区
- 合并后全部在2个二级分区
- 合并后全部在1个二级分区
,  
,4、p1,p2分区有数据,p3无数据，结果分区指定p3  ,5、p1,p2分区有数据,p3无数据，结果分区指定p99,6、p1,p2分区有数据,p3无数据，带update indexes,  
,7、p1,p3分区有数据,p2无数据，结果分区指定p3,8、p1,p3分区有数据,p2无数据，结果分区指定p99,9、p1,p3分区有数据,p2无数据，带update indexes,  
,10、p1,p2,p3分区无数据，结果分区指定p3  --全局索引不失效，p3索引分区不失效,11、p1,p2,p3分区无数据，结果分区指定p99 --同上,12、p1,p2,p3分区无数据，带update indexes --同上,  
,  
,  
,13、带subpartition template   --二级分区分布与template   保持一致,14、不带subpartition template，--合并后为一个二级分区，bound为maxvalue/default,15、带subpartition template，合并后为旧分区名  --二级分区复用原分区规格,,,,16、不带subpartition template，合并后为旧分区名，二级分区复用旧分区规格，但是数据不满足分区规则 --报错，range-list，range-list两种表类型都覆盖|  
|
|  
|  
|list-hash,list-list,list-range|  
|- 有5个分区，其中3个分区参与合并,p1,p2,p3，每个分区有3个子分区
- 单列分区键
- 多列分区键
- 合并后执行dml业务，跨分区更新，查询系统表
- 集群在merge和非merge实例执行dml
- 覆盖正常顺序、打乱顺序两种。如 p3, p1, p2 → p4
,数据迁移,21、p1,p2,p3分区都有数据，结果分区指定p3 --全局索引失效，p3索引分区失效,--如 p3, p1, p2 → p3，p3维持原来的part#,--如 p3, p1, p2 → p99，p99使用p2 的part#,- 合并后全部在3个二级分区
- 合并后全部在2个二级分区
- 合并后全部在1个二级分区
,22、p1,p2,p3分区都有数据，结果分区指定新分区p99 --全局索引失效，p3索引分区失效,- 合并后全部在3个二级分区
- 合并后全部在2个二级分区
- 合并后全部在1个二级分区
,23、p1,p2,p3分区都有数据，带update indexes   --全局索引失效，p3索引分区不失效,- 合并后全部在3个二级分区
- 合并后全部在2个二级分区
- 合并后全部在1个二级分区
,  
,24、p1,p2分区有数据,p3无数据，结果分区指定  p2,25、p1,p2分区有数据,p3无数据，结果分区指定p99,26、p1,p2分区有数据,p3无数据，带update indexes,  
,27、p1,p3分区有数据,p2无数据，结果分区指定  p1,28、p1,p3分区有数据,p2无数据，结果分区指定p99,29、p1,p3分区有数据,p2无数据，带update indexes,  
,30、p1,p2,p3分区无数据，结果分区指定p3  --全局索引不失效，p3索引分区不失效,31、p1,p2,p3分区无数据，结果分区指定p99 --同上,32、p1,p2,p3分区无数据，带update indexes --同上,  
,33、p5 bound 是默认值,A.  p5,p1  → p99(default)    ，合并分区后还是default,part#是p5,B. p1,p5  → p99(default)    ，合并分区后还是default,part#是p5,  
,34、values值分区内合理值，覆盖日期，数值，字符数据类型，表达式|  
|
|  
|表为二级分区,合并二级分区|list-range,range-range,hash-range,list-list,range-list,hash-list|A.p1 to pn ,B.for(value) TO for(value),C.p1,...,pn ,D.for(value) TO for(value),交叉覆盖到|range二级分区,1~14,15、带subpartition template 的语句，合并系统命名的二级分区|  
|
|  
|数据迁移性能|大分区 + 小分区合并|  
|a.大分区数据量远大于小分区。两分区合并时，应该选择复用大分区segment。--带分区索引|  
|
|  
|  
|大分区 + 空分区合并|  
|b.有数据分区和空分区合并时，复用有数据的大分区segment  --带分区索引|  
|
|  
|统计信息|收集统计信息|  
|1、有数据+(全局，分区)索引执行合并后收集统计信息,2、有数据+（全局，分区）索引执行合并后，rebuild索引(分区)收集统计信息|  
|
|  
|逻辑备机|主机执行合并分区语句|  
|1、表是range，list，interval分区表，带索引     --解析正确,2、表为二级分区表，合并一级分区，带主键 --解析正确,3、表为二级分区表，合并二级分区，带唯一键  --解析正确|  
|
|  
|嵌套表|一层嵌套，嵌套表和表分区指定不同的表空间|  
|1、表是range，list，interval分区表，合并分区,2、表为二级分区表，合并一级分区,3、表为二级分区表，合并二级分区,4、指定相同的表空间,--合并正常，合并后查询数据正常，分区的表空间属性正常|  
|
|  
|  
|三层嵌套，嵌套表和表分区指定不同的表空间|  
|1、表是range，list，interval分区表，合并分区,2、表为二级分区表，合并一级分区,3、表为二级分区表，合并二级分区,4、指定相同的表空间|  
|
|  
|  
|udt|  
|1、表是range，list，interval分区表，合并分区,2、表为二级分区表，合并一级分区,3、表为二级分区表，合并二级分区,4、指定相同的表空间|  
|
|  
|约束交互|主键/唯一键|  
|A 一级分区是range，list，interval，带local索引/global。 ,1、local索引带update indexes ，需要约束使用正常；,2、global索引，需要重建索引；,3、local索引不带update indexes ，需要重建索引分区；|  
|
|  
|  
|外键|  
|1、子表父表数据一一对应。是range，list，interval分区表，带索引，分别合并父表，子表 --不报错，合并后约束使用正常,2、子表父表数据一一对应。表为二级分区表，合并一级分区，分别合并父表，子表 --不报错，合并后约束使用正常,3、子表父表数据一一对应。表为二级分区表，合并二级分区，分别合并父表，子表 --不报错，合并后约束使用正常,4、子表插入数据，父表合并。父表插入数据，子表合并。|  
|
|  
|  
|check约束|  
|range，list，interval分区表，合并后约束使用正常|  
|
|  
|索引交互,-- 定义的时候，表，索引，lob都指定到不同的表空间|函数索引(local/global)|  
|1、带数据，合并一级分区，合并二级分区，合并二级分区的一级分区  --合并后索引扫描，查询数据正常，索引状态符合预期|  
|
|  
|  
|唯一索引（local/global）|  
|1、带数据，合并一级分区，合并二级分区，合并二级分区的一级分区  --合并后索引扫描，查询数据正常，索引状态符合预期|  
|
|  
|  
|列式索引（local/global）|  
|1、带数据，合并一级分区，合并二级分区，合并二级分区的一级分区  --合并后索引扫描，查询数据正常，索引状态符合预期|  
|
|  
|  
|ac|  
|1、带数据，合并一级分区，合并二级分区，合并二级分区的一级分区  --查询AC数据正常，索引状态符合预期|  
|
|  
|  
|RTREE索引（local/global）|  
|1、带数据，合并一级分区，合并二级分区，合并二级分区的一级分区  --合并后索引扫描，查询数据正常，索引状态符合预期|  
|
|  
|  
|unusable 状态索引（local/global）|  
|1、带数据，合并一级分区，合并二级分区，合并二级分区的一级分区  --合并后索引扫描，查询数据正常，索引状态符合预期|  
|
|  
|分区属性|PCTFREE,PCTUSED,INITRANS,MAXTRANS,SEGMENT CREATION,  
,包括表分区/索引分区指定,  
|  
|A. 不指定  --继承父分区的属性，如果复用了原分区，则继承原分区属性,B、指定    --按照指定,覆盖以下三种,1、表是range，list，interval分区表，合并分区。--继承父分区的属性，如果复用了原分区，则继承原分区属性,2、表为二级分区表，合并一级分区,3、表为二级分区表，合并二级分区,  
|  
|
|  
|  
|tablespace ,分区合并到不同类型的表空间,,普通->加密表空间；,普通+加密->加密表空间；,加密->普通表空间。|  
|A、结果分区不指定表空间，  lob  和索引分区跟随表所在表空间,B、结果分区指定表空间，  lob  和索引都为指定的表空间,1、表是range，list，interval分区表，合并分区。--继承父分区的属性，如果复用了原分区，则继承原分区属性,2、表为二级分区表，合并一级分区,3、表为二级分区表，合并二级分区|  
|
|  
|权限|alter table |  
|需要alter table 权限。|  
|
|  
|并发|dml+ddl|  
|1、merge 分区+ split分区 + dml 并发 + select并发 带或不带故障,2、merge 分区 +split分区 + dml 并发 + select并发在集群不同实例 带或不带故障|  
|
|  
|集群故障|  
|  
|1、merge 过程，非merge实例退出，  kill 和shutdown    --执行成功,2、merge 过程，merge实例退出，  kill 和shutdown   --失败,3、实例shutdown和merge并发 --没core,4、实例恢复过程中，merge 分区 --执行成功|  
|
|  
|大数据量|分区数据量超过10w/100w合并|  
|合并成功|  
|


  


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|是|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


  


# 4. 测试用例

  [冒烟.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczZWZkYTZhMWFkOWEzMzExZGUzNTYyIiwicmVmX2lkIjoiNjczOTZmMDQ1OTNmOTljOWZmMjM4YzIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4OTk3LCJleHAiOjE3ODI1NDUzOTd9.xbU8reNXtLUtFEVVgqcx4lQyvU1uUM5zv6AhYWZeGVg)    [merge分区.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczZWZkYTY4OTcwYzJhZjRmNTNiNzA0IiwicmVmX2lkIjoiNjczOTZmMDQ1OTNmOTljOWZmMjM4YzIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4OTk3LCJleHAiOjE3ODI1NDUzOTd9.4ah78LtYkDNsTX7Bq8YoGuy7BBbyzG67mTLMVPW0OD8)  

# 5. 测试框架设计

- *yasft  --功能和并发*
- *ha*


# 6. 测试环境说明

*单机+集群*

# 7. 工作量评估

工作量：15  *人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Attachments:

[分区支持split.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDU4OTcwYzJhZjRmNTIxZDFiIiwicmVmX2lkIjoiNjczOTZmMDQ1OTNmOTljOWZmMjM4YzIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4OTk3LCJleHAiOjE3ODI1NDUzOTd9.7AAKJjhTNTPYEpgwXYmhDY4ZbW7um_ISCpmTj_-UEr8)

 (application/x-xmind)    
