Created by 刘美秀, last modified on 十月 31, 2023

# 1. 概述

本文档主要是在分布式场景下，  支持tablespace set的相关语法，用以支撑DN扩缩容

SR：       [YDBRD-12994](https://jira.yasdb.com/browse/YDBRD-12994?src=confmacro)    -  支持tablespace set相关DDL  完成

开发设计文档：    [支持tablespace set相关DDL方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=109585470)  

  


# **2. 需求分析**

实现tablespace set相关功能

## **2.1 功能特性**

- 支持create/drop/alter tablespace set


  


**SQL语法**

```
--1. 创建tablespace set
CREATE TABLESPACE SET tablespace_set_name ON dataspace_name ((memory mapped [SIZE size_clause] )|([MAXSIZE size_clause] [NEXT size_clause] [SIZE size_clause])

MAXSIZE size_clause
该语句用于修改表空间集的最大可扩展空间，不能小于原有的最大可扩展空间。

NEXT size_clause
该语句用于修改表空间集内部的数据文件每次自动扩展的大小。

RESIZE size_clause
该语句用于修改表空间集数据文件的大小。

--2.&nbsp;alter tablespace set
ALTER TABLESPACE SET tablespace_set_name (MAXSIZE size_clause | NEXT size_clause | RESIZE size_clause)

--3.&nbsp;删除tablespace set
DROP TABLESPACE SET tablespace_set_name [cascade]

```

  


MAXSIZE和NEXT若是按照DB_BLOCK_SIZE 32K设置，然后又修改参数DB_BLOCK_SIZE为8K，会有问题吗？

现在tablespace_set$查询出memory_mapped 空间和部署时create tablespace创建出的users_aim是不是没有关联？

## **2.2 特性约束**

根据当前实现方案，该特性存在以下约束：

- tablespace set中的contents不为空时，不允许drop
- 支持maxsize大小为[128 * DB_BLOCK_SIZE, CHUNK_NUM * MAX_SPACE_FILES * DATAFILE_MAXSIZE]，当DB_BLOCK_SIZE参数为默认的8K值时，该范围为[1M, CHUNK_NUM * 32T]，chunk数量等于DN组的数量。 MAX_SPACE_FILES为表空间集允许的最大文件数量，MAX_SPACE_FILES = 64。DATAFILE_MAXSIZE为每个数据文件的最大可扩展空间，DATAFILE_MAXSIZE = 512G。
- 支持next size规格为[512 * DB_BLOCK_SIZE, 32768 * DB_BLOCK_SIZE]，当DB_BLOCK_SIZE参数为默认的8K值时，该范围为[4M,256M]。
- 支持resize 规格为[128 * DB_BLOCK_SIZE, MAXSIZE]，当DB_BLOCK_SIZE参数为默认的8K时，最小值为1M。
- 隶属于tablespace set的tablespace不能单独执行atler/drop操作


## **2.3 测试项分析**

已验证部分 SR 的测试设计如下：

  [YDBRD-1190 分布式tablespace_set create/drop/alter测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=109591655)  

  [YDBRD-6411 支持alter tablespace set 修改size测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=109591693)  

  [YDBRD-6440 支持基于内置tablespace set的分区表测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=109591696)  

  


# **3 测试设计方法**

### 3.1 特性关联领域分析：

1. 功能性：语法、结合业务场景
1. 部署形态：分布式，ha
1. 可靠性、异常：DDL过程中异常，可自动回滚或后台自动执行保障元数据最终一致
1. 易用性：是否简单易上手，报错是否明确


### 3.2 测试设计：

本次测试设计主要采用场景法以及边界值、等价类方法验证功能性、可靠性、并发

# **4 详细测试设计**

（1）测试设计如下：

### 4.1 语法验证：

|命令|参数|有效等价类|无效等价类|预期|
|:---|:---|:---|:---|:---|
|CREATE TABLESPACE SET|tss_name-公共|字母大小写    
  字母+数字    
  合法字符+字母+数字|非字母开头    
  关键字    
  非法特殊字符    
  超过长度规格    
  最大长度64    
  命名重复|  
|
|  
|ds_name|内置-users|不存在|  
|
|  
|memory   mapped|memory   mapped,memory mapped SIZE   size_clause|memory   mappe,memory   mapped   NEXT   size_clause,memory mapped MAXSIZE   size_clause|  
|
|  
|MAXSIZE   size_clause|最小及最大值：[  size  , CHUNK_NUM * 32T],中间值：1G,边界  值  ：最小值+1，最大值-1,不同单位覆盖：B/K/M/G/T/P,MAXSIZE   size_clause,MAXSIZE   size_clause   SIZE   size_clause,MAXSIZE   size_clause   SIZE   size_clause   NEXT   size_clause|>   CHUNK_NUM * 32T，<   size  ，<1M，< chunk*1M,边界值：最小值-1，最大值+1,表达式,小数、字母、E,不设置  MAXSIZE|  
|
|  
|SIZE   size_clause|最小及最大值：[chunk*  1M  , maxsize],中间值：1G,边界  值  ：最小值+1，最大值-1,不同单位覆盖：B/K/M/G/T/P,size=maxsize|> maxsize , <1M，< chunk*1M,>   CHUNK_NUM * 32T,边界值：最小值-1，最大值+1,表达式,小数、字母、E|  
|
|  
|NEXT   size_clause|[4M,256M],边界  值  ：最小值+1，最大值-1,不同单位覆盖：B/K/M|边界值：最小值-1，最大值+1,小数、字母、G/T/P|  
|
|ALTER TABLESPACE SET|tss_name|同CREATE TABLESPACE SET   tss_name,users/users_aim，用户创建|同CREATE TABLESPACE SET   tss_name|  
|
|  
|MAXSIZE size_clause |同上,MAXSIZE > 原有MAXSIZE|<原有MAXSIZE ,users_aim/  memory   mapped|  
|
|  
|RESIZE size_clause|<原有size,users_aim/  memory   mapped tss   resize|> maxsize，users/非  memory   mapped tss   resize|  
|
|  
|NEXT size_clause|同CREATE TABLESPACE SET   NEXT   |-,users_aim/  memory   mapped|  
|
|DROP TABLESPACE SET |tablespace_set_name |同上|同上,users/users_aim,drop tss下的ts，不能alter/drop|  
|
|  
|cascade|有cascade,无cascade|  
|  
|


### 4.2 功能验证：

校验：

1.执行报错的，需要观察错误提示是否简洁明确，明确是指能够有效指导用户操作

2.异常场景元数据最终一致

创建 tablespace TSS_1800_CHUNK_3/TSS_1800_CHUNK_2同名，TSS_1800_CHUNK_3 drop/alter

默认

|模块|场景|预期|
|:---|:---|:---|
|业务|create tablespace set 64个tablespace set|成功|
|  
|create tablespace set  超过64个tablespace set|报错|
|  
|DB_BLOCK_SIZE覆盖：8k/16k/32k|  
|
|  
|系统视图查询：tablesbace_set$，v$datafile，v$tablespace|  
|
|  
|create 分布表 指定 自定义tss，表类型覆盖lsc/tac，分区表/分布表|分布表 |
|  
|creat 分布表 指定 自定义 mamory mapped tss，表类型覆盖lsc/tac，分区表|  
|
|  
|create 复制表 指定 自定义 tss，|报错|
|  
|不同tablespace set下的表join/union|  
|
|  
|同一个tablespace set下的表join/union|  
|
|  
|复制表和tablespace set下的表join/union|  
|
|  
|drop/alter users/users/自定义 tablesbace set下的tablespace|  
|
|  
|创建索引/AC指定tss|报错|
|可靠性|DDL时 节点故障：执行CN、其他CN、MN/DN主节点|一阶段：MN提交前失败自动回滚，MN 提交后失败走后台自动推送|
|  
|DDL时 alter switchover|  
|
|  
|磁盘满create tss/alter tss resize，|  
|
|  
|网络丢包|  
|
|  
|故障解除后最终元数据一致|  
|
|  
|stop CN2，在CN1 执行DDL|DDL 会被记录在ddl_queue$|
|并发|不同session 并发alter/drop 同1 tss|  
|
|  
|不同session 并发alter 同1 tss|报错|
|  
|ddl/dml 业务背景下  alter/drop、drop cascade|  
|
|  
|drop/alter时  move，alter resize/maxsize/next|  
|
|HA|备机故障时create/alter/drop  tss|备机故障恢复后，元数据/datafile 能同步和主机一致|


1.route$的作用? 我看现在explain多没有写明设计的 nodegrouplist了？

2.chunkid是查哪个视图？

（2）  专项测试设计情况：

|专项|是否涉及|
|:---|:---|
|并发|是|
|可靠性|是|


# **5 测试用例**

门槛用例

  


# **6 测试框架设计**

本次测试采用codbase_test测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# **7 测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|1MN,3CN,3DNGroup|
