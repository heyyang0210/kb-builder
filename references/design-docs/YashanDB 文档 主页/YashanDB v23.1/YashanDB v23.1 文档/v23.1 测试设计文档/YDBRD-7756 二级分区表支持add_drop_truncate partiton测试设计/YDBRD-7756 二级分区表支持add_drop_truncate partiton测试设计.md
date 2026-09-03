Created by 刘美秀, last modified on 二月 27, 2024

# 1. 概述

本文档描述 二级分区表支持add/drop/truncate partiiton  /subpartition 的  测试设计

SR：       [YDBRD-7756](https://jira.yasdb.com/browse/YDBRD-7756?src=confmacro)    -  二级分区表支持add/drop/truncate partiiton  完成

开发设计文档：    [add/drop/truncate partition](https://conf.yasdb.com/pages/viewpage.action?pageId=95116037)  

# **2. 需求分析**

## **2.1 功能特性**

### （1）ADD

ALTER TABLE table_name ADD PARTITION part_name [partion_bound_clause]

  


**功能**

- add多个一级分区(hash只能一个)，每个分区有多个二级分区    
  指定add分区的segment creation和tablespace属性    
  add一个一级分区，如果没有指定二级分区，会用二级分区模板，如果没有模板，创建默认二级分区    
  add子分区后，也会add对应的local索引子分区


**约束**

- range分区只能add bound最大的分区，如果需要增加中间的分区，需要使用split(未实现)功能    
  list分区如果已经存在default分区，则不能add partition    
  hash分区每次只能add一个hash分区，同时需要进行数据移动


### （2）DROP

ALTER TABLE table_name DROP PARTITION part_name, ...    
  ALTER TABLE table_name DROP SUBPARTITION subpart_name, ...

**功能**

- drop一个子分区
- drop同一分区下的多个子分区
- drop子分区，local索引相应的子分区也被drop


**约束**

- 不能删除一个分区下所有的subpartiton
- 不能drop hash subpartition/partition
- 不能跨分区drop二级分区


### （3）TRUNCATE

ALTER TABLE table_name TRUNCATE PARTITION [part_name, ...]     
  ALTER TABLE table_name TRUNCATE SUBPARTITION [subpart_name, ...]

**功能**

- truncate多个分区
- truncate多个子分区（不必是同个分区）


# **3 测试设计方法**

### 3.1 特性关联领域分析：

- 功能性：语法、结合业务场景分区类型：hash-hash、hash-list、hash-range、 range-range、range-hash、range-list、list-list、list-range、list-hash    
  表空间类型：MMS、自定义、default、加密、压缩
- 表类型：heap、列存拦截（tac、lsc）
- 分区键类型：--不需要
- 其他：lob、索引


- 部署形态：单机、集群--  拦截
- 可靠性、异常：DDL过程中异常，可自动回滚
- 易用性：是否简单易上手，报错是否明确


### 3.2 测试设计：

本次测试设计主要采用设计方法如下：

语法、功能校验：等价类划分法，场景法、路径覆盖

可靠性、并发：场景法

  


设计视图：dba_tab_subpartitions，dba_subpartition_templates，dba_lob_subpartitions, dba_ind_subpartitions，

# **4 详细测试设计**

（1）测试设计如下：

|命令|场景|有效等价类|无效等价类|预期|
|---|---|---|---|---|
|ADD PARTITION|part_name|字母大小写    
  字母+数字    
  合法字符+字母+数字|非字母开头、  关键字、  非法特殊字符    
  超过长度规格、  最大长度64、  命名重复|  
|
|  
|subpart_name|同上|  
|  
|
|  
|add一个一级分区，不指定模板，不定义子分区（分区类型覆盖）|  
|  
|成功|
|  
|add一个一级分区，指定模板，不定义子分区（分区类型覆盖）|  
|  
|成功|
|  
|add一个一级分区，指定模板，定义多个子分区（分区类型覆盖）|  
|  
|成功|
|  
|add多个一级range和list分区|  
|  
|成功|
|  
|add多个一级hash分区|  
|  
|报错|
|  
|add多个hash二级分区（分区类型覆盖）|  
|  
|~~报错~~    成功|
|  
|建表 segment creation immediate，add 分区segment creation immediate|  
|  
|  
|
|  
|建表 segment creation immediate，add 分区segment creation defered|  
|  
|  
|
|  
|建表 segment creation defered，add 分区segment creation immediate|  
|  
|  
|
|  
|建表 segment creation defered，add 分区segment creation defered|  
|  
|  
|
|  
|指定表空间（表空间类型覆盖）|  
|  
|  
|
|  
|重分布, hash 数据会重分布，影响2个分区（一级分区为hash）|  
|  
|  
|
|  
|add后插入到 该分区并查询，指定分区查询（分区类型覆盖）|  
|  
|  
|
|  
|insert带lob列（分区类型覆盖）|  
|  
|  
|
|  
|insert into select 插入多行到add 分区（分区类型覆盖）|  
|  
|  
|
|  
|update 跨分区更新到add 分区：update 分区键列（分区类型覆盖）|  
|  
|  
|
|  
|update 涉及多个分区、多个子分区（分区类型覆盖）|  
|  
|  
|
|  
|update lob列（分区类型覆盖）|  
|  
|  
|
|  
|delete涉及多个分区（分区类型覆盖）|  
|  
|  
|
|  
|delete lob（分区类型覆盖）|  
|  
|  
|
|  
|分区列类型覆盖：Q  类型是否有影响，如lob，array，nchar等---不涉及|  
|  
|  
|
|  
|指定分区名查询（分区类型覆盖）|  
|  
|  
|
|  
|指定二级分区名查询（分区类型覆盖）|  
|  
|  
|
|  
|二级分区个数边界：1个1级分区最多能创建几个二级分区：一个表1M-1|  
|  
|  
|
|  
|一级分区个数边界：1M-1|  
|  
|  
|
|DROP PARTITION|part_name|  
|  
|  
|
|  
|drop hash分区|  
|  
|失败|
|  
|drop list/range分区|  
|  
|成功|
|  
|drop 不存在分区|  
|  
|报错|
|  
|drop 多个分区|  
|  
|成功|
|  
|drop 所有分区|  
|  
|报错|
|  
|drop重复分区，如drop p1,p2,p1|  
|  
|报错|
|  
|带lob列，drop 分区|  
|  
|  
|
|  
|带local 索引，drop 单个分区|  
|  
|  
|
|  
|带local 索引，drop 多个分区|  
|  
|  
|
|  
|drop 后查询回收站|  
|  
|不进入回收站|
|DROP SUBPARTITION|subpart_name|  
|  
|  
|
|  
|drop hash分区|  
|  
|成功|
|  
|drop list/range分区|  
|  
|成功|
|  
|drop 不存在子分区|  
|  
|报错|
|  
|drop 多个子分区|  
|  
|成功|
|  
|drop 所有子分区|  
|  
|报错|
|  
|drop重复子分区，如drop sp1,sp2,sp1|  
|  
|报错|
|  
|带lob列，drop 子分区|  
|  
|成功|
|  
|带lob列，drop 子分区|  
|  
|成功|
|  
|带local 索引，drop 单个子分区|  
|  
|成功|
|  
|带local 索引，drop 多个子分区，子分区在同一分区|  
|  
|成功|
|  
|drop 多个子分区，子分区在不同分区|  
|  
|报错|
|  
|truncate 后查询回收站|  
|  
|不进入回收站|
|TRUNCATE PARTITION|part_name|  
|  
|  
|
|  
|truncate hash分区|  
|  
|成功|
|  
|truncate list/range分区|  
|  
|成功|
|  
|truncate 不存在分区|  
|  
|报错|
|  
|truncate 多个分区，|  
|  
|成功|
|  
|truncate 所有分区|  
|  
|成功|
|  
|truncate 重复分区，如drop p1,p2,p1|  
|  
|报错|
|  
|带lob列，truncate 分区|  
|  
|  
|
|  
|带local 索引，truncate 单个分区|  
|  
|  
|
|  
|带local 索引，truncate 多个分区|  
|  
|  
|
|  
|truncate后插入数据到子分区，并查询|  
|  
|  
|
|  
|truncate 后查询回收站|  
|  
|不进入回收站|
|  
|sequment imm分区truncate|  
|  
|sequment 会被清掉|
|TRUNCATE SUBPARTITION|subpart_name|  
|  
|  
|
|  
|truncate hash分区|  
|  
|成功|
|  
|truncate list/range分区|  
|  
|成功|
|  
|truncate 不存在子分区|  
|  
|报错|
|  
|truncate 多个子分区|  
|  
|成功|
|  
|truncate 所有子分区|  
|  
|  
|
|  
|truncate 重复子分区，如drop sp1,sp2,sp1|  
|  
|报错|
|  
|带lob列，truncate 子分区|  
|  
|  
|
|  
|带lob列，truncate 子分区|  
|  
|  
|
|  
|带local 索引，truncate 单个子分区|  
|  
|  
|
|  
|带local 索引，truncate 多个子分区|  
|  
|  
|
|  
|truncate 后查询回收站|  
|  
|不进入回收站|
|  
|sequment imm分区truncate|  
|  
|sequment 会被清掉|
|其他|创建/启用审计：以上sql 都能被审计|  
|  
|  
|
|  
|add 分区后备份，备份，,drop分区后，恢复备份|  
|  
|drop 掉的分区能被恢复|
|并发|dml + add 并发|  
|  
|  
|
|  
|dml + drop 并发|  
|  
|  
|
|  
|dml + truncae 并发|  
|  
|  
|
|  
|add/drop/truncate 并发,alter table add column+add|  
|  
|lock|
|  
|导入+drop 并发|  
|  
|不会core|
|可靠性|节点故障：add/drop/truncate 时Kill 主机|  
|  
|失败自动回滚|
|  
|switchover：add/drop/truncate 时Kill switchover|  
|  
|失败自动回滚|
|  
|shuntdown：add/drop/truncate 时 cluster restart|  
|  
|失败自动回滚|
|  
|磁盘：磁盘满时 add/drop/truncate |  
|  
|  
|
|  
|资源：CUP/IO 高时  add/drop/truncate |  
|  
|  
|
|HA|主机add/drop/truncate，查看备机|  
|  
|备机能同步|
|  
|add 后switchover，新主机上insert/update/delete 到add 的分区|  
|  
|成功|
|  
|add 后kill 主机，failover，新主机上insert/update/delete 到add 的分区|  
|  
|成功|


  


  


（2）  专项测试设计情况：

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|是|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


  


**2024/01/02 chenrui**

**质量加固补充测试点：**

**转测范围：二级分区表的 **  add/drop/truncate partiiton  /subpartition，对一级分区表的add/drop/truncate 加固不在以下范围，另外设计

1、数据

    1.1 重分布索引扫描和表扫描数据一致

    1.2 数据量大的场景，数据重新分布（hash-list/hash-range/hash-hash）

    1.3 表空间 重分布到不同表空间

    1.4 insert into for partition/for subpartition/insert into select *

    1.5 插入的数据在分区边界，插入的数据不在分区边界

    1.6 跨分区更新

  


2、交互：带lob列/rtee/列式/函数/reverse索引/唯一索引（本地和全局）/udt/嵌套表（单层/2层/3层）/AC/约束

   2.1 多层嵌套表，包含数据重分布和新增空分区两种

   2.2 带rtree 本地索引，包含数据重分布和新增空分区两种。

   2.3 函数本地索引，重分布后索引状态正常，索引扫描数据

   2.4 带AC（二级分区不支持创建AC，只涉及一级分区）

   2.5 drop/truncate 一级分区/二级分区 

         1、本地索引状态正常

         2、全局索引失效

         3、失效后的索引 rebuild 后正常

    2.6 唯一索引

          索引unusable 状态，add drop truncate table

   2.7 约束

         disable 状态/enable 状态，add drop truncate table

  


3、与其他操作并行，统计信息，shrink table

     add /DROP/truncate 后收集表统计信息、shrink table

  


4、附加日志

  


5、数据

    5.1 功能用例增加数据量，现有用例数据量较少（1~5条左右）

    5.1 新增分区插入null值

          truncate 的分区包含null值

          drop 的分区包含null值

  


6、其他：集群故障场景，  宽表

  


7、检查项

    ha

    testkill，检查用例执行正常：增加add/drop/truncate 与alter index xxx rebuild partition online、coalease

    功能用例与用例例场景对应

    未自动化用例

    已有有问题但发散，外场问题单发散

    构造错误码报错场景 --提示信息易懂，报错场景符合

    资料验证

  

  


|  
|测试场景|有效类|无效类|预期|
|---|---|---|---|---|
|add partition|range-x,list-x,hash-x|插入的数据，满足二级分区边界值|插入的数据，不满足二级分区边界值|  
|
|  
|  
|新增分区跨分区更新|  
|  
|
|hash分区重分布|hash分区重分布|走索引扫描和走表扫描，查询新增分区/旧分区数据一致|  
|验证分区数据准确,走索引扫描和走表扫描，查询新增分区/旧分区数据一致|
|  
|  
|数据量大重新分布。100w条|  
|  
|
|  
|重分布的数据有null|  
|  
|  
|
|约束|外键|子表|  
|  
|
|  
|  
|父表|  
|  
|
|  
|  
|带级联更新，update/delete 父表|  
|  
|
|  
|check约束|  
|  
|  
|
|  
|主键|  
|  
|  
|
|  
|唯一键|  
|  
|  
|


  


  


  


# **5 测试用例**

门槛用例，查看文本用例中L0部分

  


文本用例

  


# **6 测试框架设计**

本次测试采用codbase_test测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# **7 测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|1节点部署,1主2备部署|


## Attachments:

[二级分区adddroptruncate partiton.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmU4OTcwYzJhZjRmNTFmODBmIiwicmVmX2lkIjoiNjczOTY5NmQ3MjgyMDZlZmI5MmVmMzRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDQ4LCJleHAiOjE3ODIyMTM4NDh9.SQWuiR23c-JS2d_yMeMm_DhOWkrQ3XbdZ7RPGU_bwBo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[二级分区adddroptruncate partiton.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmU4OTcwYzJhZjRmNTFmODEwIiwicmVmX2lkIjoiNjczOTY5NmQ3MjgyMDZlZmI5MmVmMzRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDQ4LCJleHAiOjE3ODIyMTM4NDh9.i53BwwPv-QC6LvPnWlyvvKW_9rGLO0_eX4fh3pYCACE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
