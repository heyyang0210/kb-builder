Created by 马爽, last modified on 五月 17, 2024

**IR链接：**    [https://pingcode.yasdb.com/ship/ideas/660b7443009f91eb87f2b328](https://pingcode.yasdb.com/ship/ideas/660b7443009f91eb87f2b328)    **?**    
  **#YASHAN-984 集群支持全局资源信息dump能力**

**关联SR链接：**    [https://pingcode.yasdb.com/pjm/items/6611a8eb579a3edb84d861c9](https://pingcode.yasdb.com/pjm/items/6611a8eb579a3edb84d861c9)    **?**    
  **#YDBRD-25891 集群支持全局block资源dump**

**开发概要设计文档：**    [集群支持全局block资源dump](https://conf.yasdb.com/pages/viewpage.action?pageId=150604630)  

**测试概要设计文档：**    [YDBRD-28759 测试概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147770400)  

# 1. 概述

        单机和集群支持  通过alter system dump datafile命令dump 出某个datafile单个或多个连续block信息，并保存至diag/trace目录下文件中。

        block在内存中，dump内存对应信息和磁盘信息；不在内存中，只dump磁盘相关信息，该特性需要重点保证dump信息的正确性。

# 2. 需求分析

## 2.1 功能点分析

#### 2.1.1 基本sql语法功能

提供给用户dump命令可手动将系统内部结构信息转储到trace文件中，这些信息可被用于进行故障问题的跟踪和分析。

1、  ALTER   SYSTEM   DUMP   DATAFILE   6  ;--  DUMP整个数据文件

2、  ALTER   SYSTEM   DUMP   DATAFILE   6   BLOCK   0  ;--  DUMP某个数据文件的一个block

3、  ALTER   SYSTEM   DUMP   DATA FILE   6   MINBLOCK   128   MAXBLOCK   137；--  DUMP某个数据文件的一批block

#### 2.1.2 新增机制对比

|部署形态|block所在位置|dump内容|dump功能机制变更|
|---|---|---|---|
|单机|disk block|disk block内容，包含block haed以及block的具体内容|减少加载到buffer操作，直接从disk中获取block信息|
|  
|buffer block|buffer ctrl、disk block|新增存储buffer ctrl信息|
|集群|disk block|disk block内容|新增功能，与单机保持一致|
|  
|buffer block|buffer ctrl、gcs、disk block|新增功能，与单机相比新增了gcs内容|


#### 2.1.3 dump信息字段说明

![](https://pingcode.yasdb.com/atlas/files/public/67396d128970c2af4f52101c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBRUFBQUFBQUFBQUJJQkFBQUFBQkFBQUFFZ0FBQUFBa0FBQUFBQ0FBQUFoQ0FnRUFBRUFBZ0FBZ0VBQUJBQkFBQUFBQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQVVBQUFJSUlBQUFBRUFBQUFFQUFBQUFBQkFBQUFBQUJFQUFFQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU2OTksImV4cCI6MTc4MjMxNjQ5OX0.swn_i8GNUExK_kAyt2b1j-QZwqEz8BXd-LsqKpXwwvU)

dump信息主要分为三大部分:

- Part 1：BUFFER CTRL DUMP（buffer ctrl的dump信息）


1. OBJ#：该block属于哪个对象，如果block不属于任何对象（如space head block、bitmap block等），则该字段为-1
1. isFlushing：是否被ckpt标记正在刷盘
1. isPinned：block unrecyclable temporarily. Such as undo blocks in rollbacking属于一种block不可被recyle的状态
1. isResident：是否是常驻页面，如temp extent map block
1. isAim：是否是all in memory block，在创建表空间时指定MEMORY MAPPED字段，集群下不支持aim block
1. isGcConverting：是否有线程正在走gcs流程申请latch block
1. isRemoteVisit：是否正在被远端请求访问（其他实例发来的block相关的消息请求）
1. 其余字段参考V$BUFFER_CONTROL:       [https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/V$BUFFER_CONTROL.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/V$BUFFER_CONTROL.html)  


- Part 2：GLOBAL CACHE SERVICE DUMP（gcs resource的dump信息）


1. master：在集群下管理该blockId的gcs资源的实例
1. id：gcs resource id（grm entry中的id）
1. bucketId：gcs resource所在的bucketId
1. hashNext：所在bucket的下一个gcs resource
1. flag：对应GrcResFlags结构体
1. refCount：gcs resource的引用次数
1. LIST OF REQUEST DUMP：gcs resource当前的请求队列信息（队列最长为64）


- Part 3：DISK BLOCK DUMP（实际数据页面的dump内容，沿用单机）


![](https://conf.yasdb.com/download/attachments/150604630/image2024-4-10_14-40-44.png?version=1&modificationDate=1712731244000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBRUFBQUFBQUFBQUJJQkFBQUFBQkFBQUFFZ0FBQUFBa0FBQUFBQ0FBQUFoQ0FnRUFBRUFBZ0FBZ0VBQUJBQkFBQUFBQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQVVBQUFJSUlBQUFBRUFBQUFFQUFBQUFBQkFBQUFBQUJFQUFFQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU2OTksImV4cCI6MTc4MjMxNjQ5OX0.swn_i8GNUExK_kAyt2b1j-QZwqEz8BXd-LsqKpXwwvU)

#### 2.1.4 相关视图观测

通过查询V$BUFFER_CONTROL视图指定TS#、FILE#、BLK#（对应blockId 0-0-0）来判断block是否在buffer中

|字段|类型|说明|
|---|---|---|
|TS#|INTEGER|buffer加载页面的表空间ID|
|FILE#|INTEGER|buffer加载页面的文件ID|
|BLK#|INTEGER|buffer加载页面的页面ID|


## 2.2 应用场景

#### 2.2.1 需求本身的主要应用场景

1、  数据库出现问题，可作为开发分析定位的入口，dump解析页面信息

2、  dump操作转储的是某一时点的业务数据，多次dump可以跟踪页面变化

#### 2.2.2 需求与其他特性的关联场景

1、实例启停

2、实例故障，在线恢复

3、业务类型——不同表空间业务

## 2.3 规格约束

#### 2.3.1 需求定义的规格、约束，系统/模块上下文等

- 产品形态：单机（行存+列存），集群
- 节点个数：集群下  2节点和4节点无差异性，直接在2节点进行测试即可


#### 2.3.2 内部机制涉及的规格约束

- 仅支持db mount/open时dump


# 3. 详细测试设计

## 3.1 测试设计方法

1、针对基本语法的测试，yasft上已有单机用例维护    [standalone/testcase/DFX/dump · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/DFX/dump)    ，集群下的语法测试复用单机用例

2、单机形态下的功能测试，复用已有自动化用例    [ha/ha_heap/testcase/ha_schedule_common/DFX/dump · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_heap/testcase/ha_schedule_common/DFX/dump)    ，需要补充测试新机制下buffer block的dump文件信息校验

3、集群形态下的功能测试，可从以下几点进行重点测试：

1、dump信息的正确性（磁盘block，buffer block），覆盖不同类型的表空间datafile（redo，undo，data, temp等，这里要考虑自定义表空间），覆盖不同类型的block（current block，cr block等）-----这里采用等价类、正交组合法进行组合测试    
  2、并发dump的情况（单实例并发dump，多实例并发dump）    
  3、业务过程中dump（这里除了考虑功能正确性之外，还要考虑对性能的影响）    
  4、dump过程中故障    
  5、启停并发过程中dump

## 3.2 详细测试设计

#### 3.2.1 基本功能测试

**涉及因子**

|因子项|因子类型|说明|
|---|---|---|
|部署形态|单机|  
|
|  
|集群|  
|
|业务类型|heap|  
|
|  
|tac|集群下不支持|
|  
|lsc||
|block位置|disk block|  
|
|  
|buffer block|  
|
|block数量|1个|  
|
|  
|多个连续|  
|
|  
|全部|  
|
|datafile类型|system表空间data|  
|
|  
|sysaux表空间data|  
|
|  
|undo表空间data|  
|
|  
|redo data|  
|
|  
|swap表空间data|  
|
|  
|users表空间data|  
|
|  
|全局/本地temp表空间data|  
|
|  
|普通表空间data|  
|
|  
|加密表空间data|  
|
|  
|压缩表空间data|  
|
|  
|自定义表空间data|  
|
|  
|MMS|集群下不支持，对应aim block|
|block类型|current block|  
|
|  
|cr block|  
|
|  
|data block、space head block、bitmap block、undo block、aim block等等|可在不同的datafile类型下覆盖测试|


将以上因子作正交组合，可得到以下测试场景

|场景编号|部署类型|业务类型|block位置|block数量|datafile、block类型|测试步骤|预期结果|备注|
|---|---|---|---|---|---|---|---|---|
|1|单机|heap|buffer block|1个|普通表空间data|在普通表空间上下发业务，dump 普通表空间datafile下1个block|dump成功，转储信息正确|冒烟|
|2|  
|tac|buffer block|多个|加密压缩表空间data|在加密压缩空间上下发业务，dump 普通表空间datafile下多个block|dump成功，转储信息正确|(需要对稳态数据和实时数据的dump block信息进行对比）|
|3|  
|lsc|buffer block|全部|MMS|在mms表空间上下发业务，dump 普通表空间整个datafile|dump成功，转储信息正确|重点关注isAim字段|
|4|集群|heap|disk block|1个|system表空间data|两实例集群，实例1下发触发器、过程、包业务提交，实例2 dump system表空间datafile下1个block|dump成功，转储信息正确|  
|
|5|  
|  
|  
|多个|sysaux表空间data|两实例集群，实例1下发快照业务提交，实例2 dump sysaux表空间datafile下多个block|dump成功，转储信息正确|  
|
|6|  
|  
|  
|全部|undo表空间data|两实例集群，实例1下发创建和管理回滚业务提交，实例2 dump undo表空间整个datafile|dump成功，转储信息正确|  
|
|7|  
|  
|  
|多个|swap表空间data|两实例集群，实例1触发swap表空间换入换出提交，实例2 dump swap表空间datafile下多个block|dump成功，转储信息正确|  
|
|8|  
|  
|  
|全部|users表空间data|两实例集群，实例1下发用户相关业务提交，实例2 dump users表空间整个datafile|dump成功，转储信息正确|  
|
|9|  
|  
|  
|1个|全局/本地temp表空间data|两实例集群，实例1下发临时表空间相关业务提交，实例2 dump temp表空间datafile下1个block|dump成功，转储信息正确|冒烟|
|10|  
|  
|  
|多个|普通表空间data|两实例集群，实例1下发普通表业务提交，实例2 dump 普通表空间datafile下多个block|dump成功，转储信息正确|冒烟|
|11|  
|  
|  
|全部|加密表空间data|两实例集群，实例1在加密表空间上下发业务提交，实例2 dump 加密表空间整个datafile|dump成功，转储信息正确|  
|
|12|  
|  
|  
|1个|压缩表空间data|两实例集群，实例1在压缩表空间上下发业务提交，实例2 dump 压缩表空间datafile下1个block|dump成功，转储信息正确|  
|
|13|  
|  
|  
|多个|自定义表空间data|两实例集群，实例1在自定义表空间上下发业务提交，实例2 dump 压缩表空间datafile下多个block|dump成功，转储信息正确|  
|
|14|  
|  
|buffer block|1个|system表空间data|两实例集群，实例1下发触发器、包、过程业务提交之前，实例2 dump system表空间datafile下1个block|dump成功，转储信息正确|  
|
|15|  
|  
|  
|多个|sysaux表空间data|两实例集群，实例1下发快照业务提交之前，实例2 dump sysaux表空间datafile下多个block|dump成功，转储信息正确|  
|
|16|  
|  
|  
|全部|undo表空间data|两实例集群，实例1下发创建和管理回滚业务提交之前，实例2 dump undo表空间整个datafile|dump成功，转储信息正确|  
|
|17|  
|  
|  
|多个|swap表空间data|两实例集群，实例1触发swap表空间换入换出提交之前，实例2 dump swap表空间datafile下多个block|dump成功，转储信息正确|  
|
|18|  
|  
|  
|全部|users表空间data|两实例集群，实例1下发用户相关业务提交之前，实例2 dump users表空间整个datafile|dump成功，转储信息正确|  
|
|19|  
|  
|  
|1个|全局/本地temp表空间data|两实例集群，实例1下发临时表空间相关业务提交之前，实例2 dump temp表空间datafile下1个block|dump成功，转储信息正确|冒烟|
|20|  
|  
|  
|多个|普通表空间data|两实例集群，实例1下发普通表业务提交之前，实例2 dump 普通表空间datafile下多个block|dump成功，转储信息正确|冒烟|
|21|  
|  
|  
|全部|加密表空间data|两实例集群，实例1在加密表空间上下发业务提交之前，实例2 dump 加密表空间整个datafile|dump成功，转储信息正确|  
|
|22|  
|  
|  
|1个|压缩表空间data|两实例集群，实例1在压缩表空间上下发业务提交之前，实例2 dump 压缩表空间datafile下1个block|dump成功，转储信息正确|  
|
|23|  
|  
|  
|多个|自定义表空间data|两实例集群，实例1在自定义表空间上下发业务提交之前，实例2 dump 压缩表空间datafile下多个block|dump成功，转储信息正确|  
|
|24|  
|  
|  
|全部|cr block|两实例集群，实例1下发相关业务并提交之前，实例2 dump一个cr block, 实例1 dump整个datafile|dump成功，转储信息正确|冒烟|
|25|  
|  
|  
|1个|current block|两实例集群，实例1下发业务之前，实例2 dump一个cr block, 实例1 dump1个block|dump成功，转储信息正确|  
|


#### 3.2.2  并发场景——集群

|场景编号|是否带业务|具体场景|测试步骤|预期结果|备注|
|---|---|---|---|---|---|
|1|dump时不带业务|实例1多个session同时执行dump操作（同一个datafile）|两实例集群，实例1多个session同时执行dump操作（同一个datafile）|dump成功，转储信息正确|冒烟|
|2|  
|实例1多个session同时执行dump操作（不同个datafile）|两实例集群，实例1多个session同时执行dump操作（不同个datafile）|dump成功，转储信息正确|  
|
|3|  
|实例1和实例2同时执行dump操作（同一个datafile）|两实例集群，实例1和实例2同时执行dump操作（同一个datafile）|dump成功，转储信息正确|冒烟|
|4|  
|实例1和实例2同时执行dump操作（不同个datafile）|两实例集群，实例1和实例2同时执行dump操作（不同个datafile）|dump成功，转储信息正确|  
|
|5|dump时带业务|dump过程中resize datafile|两实例集群，实例1和实例2执行  dump过程中实例1 resize datafile|dump成功，转储信息正确|暂不支持|
|6|  
|dump过程中shrink datafile/tablespace|两实例集群，实例1和实例2执行  dump过程中实例1 shrink tablespace|dump成功，转储信息正确|暂不支持|
|7|  
|dump过程中offline datafile/tablespace|两实例集群，实例1和实例2执行  dump过程中实例1 offline datafile/tablespace|dump成功，转储信息正确|暂不支持|
|8|  
|dump过程中rename datafile/tablespace|两实例集群，实例1和实例2执行  dump过程中实例1 rename datafile/tablespace|dump成功，转储信息正确|  
|
|9|  
|dump过程中drop datafile/tablespace|两实例集群，实例1和实例2执行  dump过程中实例1 drop datafile/tablespace|dump成功，转储信息正确|  
|
|10|  
|dump的过程中有业务正在写block|两实例集群，实例1和实例2执行  dump过程中实例1 执行dml业务写block，触发到datafile extent扩展操作|dump成功，转储信息正确|冒烟|


#### 3.2.3 故障场景

|场景编号|故障类型|具体场景|测试步骤|预期结果|备注|
|---|---|---|---|---|---|
|1|实例启停|master实例dump过程中master实例停止|两实例集群，master节点dump和master实例启停并发|环境正常无core|  
|
|2|  
|master实例dump过程中非master实例启停|两实例集群，master节点dump和非master实例启停并发|环境正常无core|  
|
|3|  
|非master实例dump过程中master实例停止|两实例集群，非master节点dump和master实例启停并发|环境正常无core|  
|
|4|  
|非master实例dump过程中非master实例停止|两实例集群，非master节点dump和非master实例启停并发|环境正常无core|  
|
|5|kill -9 |master实例dump和master实例kill后重新拉起并发|两实例集群，master节点dump和master实例kill后重新拉起并发|环境正常无core|  
|
|6|  
|master实例dump和非master实例kill后重新拉起并发|两实例集群，master节点dump和非master实例kill后重新拉起并发|环境正常无core|  
|
|7|  
|非master实例dump和master实例kill后重新拉起并发|两实例集群，非master节点dump和master实例kill后重新拉起并发|环境正常无core|  
|
|8|  
|非master实例dump和非master实例kill后重新拉起并发|两实例集群，非master节点dump和非master实例kill后重新拉起并发|环境正常无core|  
|
|9|reboot|master实例dump过程中master实例停止|两实例集群，master节点dump和master实例reboo并发|环境正常无core|手动测试，无法自动化    
    
    
    
|
|10|  
|master实例dump过程中非master实例启停|两实例集群，master节点dump和非master实例reboot并发|环境正常无core||
|11|  
|非master实例dump过程中master实例停止|两实例集群，非master节点dump和master实例reboot并发|环境正常无core||
|12|  
|非master实例dump过程中非master实例停止|两实例集群，非master节点dump和非master实例reboot并发|环境正常无core||


#### 3.2.4 其他场景

|场景编号|具体场景|测试步骤|预期结果|备注|
|---|---|---|---|---|
|1|db非open/mount状态下dump block|两实例集群，停止实例2，以nomount模式重新启动，执行dump操作，切换到mount模式，继续执行dump操作成功，切换到open模式，继续执行dump操作成功，|dump操作失败|冒烟|
|2|block页面损坏时dump block|两实例集群，实例1构造block业务损坏的情况，实例1和实例2执行dump操作|dump操作失败|  
|
|3|dump超大的block文件|两实例集群，实例1构造较大的block页面（16K、32K)，实例1和实例2执行dump操作|dump操作成功|  
|
|4|trace文件不存在或被删除后dump操作|两实例集群，实例1删除trace文件后，实例1和实例2执行dump操作|dump会创建trace文件，名称正确|  
|
|5|相同的datafile新建之后删除前后对比|两实例集群，实例1在datafile下发业务后执行dump操作，实例2删除datfile新建相同的datafile下发业务后执行dump操作|dump前后信息不一致，关注正确性校验|  
|
|6|相同的datafile新建之后修改前后对比|两实例集群，实例1在datafile下发业务后执行dump操作，实例2修改datfile下发业务后执行dump操作|dump前后信息不一致，关注正确性校验|  
|


3.2.2 梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|测试点|
|:---|:---|:---|
|CT|是|基本数据正确性校验|
|KT|是|并发+故障|
|长稳|/|该需求的测试属于功能层面，不会对长稳集群产生影响|
|一致性|是|该需求涉及多个实例IO读盘和写盘的一致性问题|
|三方测试工具    
  (sqltest，sqlancer)|/|该需求不涉及任何sql语法层面的新增和修改，所以不涉及sql语法层面的工具|
|安全|是|dump完成后需要检查是否涉及敏感信息|
|DFR|/|同长稳场景一致不需要考虑|
|HA|/|该需求和HA特性没关联，不管是HA还是非HA形态，机制都是一样的|
|压力|/|该需求在压力场景下和长稳场景下的表现是一样的，没有差异性，所以不考虑该专项|
|性能|是|dump操作涉及磁盘读，运行时间势必受数据量和IO影响。   |
|可维护性|是|涉及到资料变更，需要  修改文档说明不同场景下dump datafile的内容差异|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- 不涉及新框架的新增
- 涉及新增自动化脚本
- 新增用例说明：


|用例类型|测试框架|用例目录|用例个数|备注|
|:---|:---|:---|:---|:---|
|基础语法和功能|yasft/ha|单机：    [ha/ha_heap/testcase/ha_schedule_common/DFX/dump · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_heap/testcase/ha_schedule_common/DFX/dump)  ,集群：    [ha/ha_cluster/testcase/common/dump_datafile · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_cluster/testcase/common/dump_datafile)  |27|  
|


# 6. 测试集群说明

功能测试环境

# 7. 工作量评估

工作量：14  *人天*

# 8. 上车工程分析

第一次上车构建：

|工程|工程链接|失败用例|备注|
|---|---|---|---|
|单机|  
|  
|  
|
|1,  
|  [Agile_L2_sa_heap_HA_5_docker #3751 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/3751/)  ,  
|ha/ha_heap/testcase/ha_schedule/DB_objects/ha_anonymous_block.py,ha/ha_heap/testcase/ha_schedule_backup/backup_yasrman_xmlfile/test_dir_ydbrd26670_yasrman01.py,ha/ha_heap/testcase/ha_schedule_backup/backup_yasrman_xmlfile/test_dir_ydbrd26670_yasrman01.py–失败原因未知，跑lastfail,第二次构建成功：,  [Agile_L2_sa_heap_HA_5_docker #3769 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/3769/)  |pass|
|2|  [Agile_L2_sa_heap_HA_6_docker #3718 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/3718/)  |ha/ha_heap  /testcase/ha_schedule_backup/backup_yasrman/test_sdv_ydbrd_26669_yasrman_pitr_001.py,ha/ha_heap  /testcase/ha_schedule_backup/backup_yasrman/test_sdv_ydbrd_26669_yasrman_pitr_002.py,ha/ha_heap  /testcase/ha_schedule_backup/backup_yasrman/test_sdv_ydbrd_26669_yasrman_pitr_003.py,ha/ha_heap  /testcase/ha_schedule_backup/backup_yasrman/test_sdv_ydbrd_26669_yasrman_pitr_004.py,ha/ha_heap  /testcase/ha_schedule_backup/backup_yasrman/test_sdv_ydbrd_26669_yasrman_pitr_005.py,ha/ha_heap  /testcase/ha_schedule_backup/backup_yasrman/test_sdv_ydbrd_26669_yasrman_pitr_006.py,ha/ha_heap  /testcase/ha_schedule_backup/backup_yasrman/test_sdv_ydbrd_26669_yasrman_pitr_007.py,ha/ha_heap  /testcase/ha_schedule_backup/backup_yasrman/test_sdv_ydbrd_26669_yasrman_pitr_008.py,ha/ha_heap  /testcase/ha_schedule_backup/backup_yasrman/test_sdv_ydbrd_26669_yasrman_pitr_009.py,ha/ha_heap/  testcase/ha_schedule_backup/backup_yasrman_xmlfile/test_sdv_ydbrd26670_yasrman01.py,ha/ha_heap/  testcase/ha_schedule_backup/backup_yasrman_xmlfile/test_sdv_ydbrd26670_yasrman02.py,ha/ha_heap/  testcase/ha_schedule_backup/backup_yasrman_xmlfile/test_sdv_ydbrd26670_yasrman03.py  –失败原因未知，跑lastfail,第二次构建失败：用例目录调整，跑lastfail失败,  [Agile_L2_sa_heap_HA_6_docker #3734 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/3734/)  |  
|
|3|  [Agile_L2_sa_lsc_yasft_arm #2420 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/2420/)  |/storage/lsc_features/rgd_optimize/ydbrd_29806_rgd_optimize_02,/storage/lsc_features/rgd_optimize/ydbrd_29806_rgd_optimize_03,/storage/lsc_features/rgd_optimize/ydbrd_29806_rgd_optimize_04--rebase最新代码,![](https://pingcode.yasdb.com/atlas/files/public/67396d138970c2af4f52101e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBRUFBQUFBQUFBQUJJQkFBQUFBQkFBQUFFZ0FBQUFBa0FBQUFBQ0FBQUFoQ0FnRUFBRUFBZ0FBZ0VBQUJBQkFBQUFBQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQVVBQUFJSUlBQUFBRUFBQUFFQUFBQUFBQkFBQUFBQUJFQUFFQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU2OTksImV4cCI6MTc4MjMxNjQ5OX0.swn_i8GNUExK_kAyt2b1j-QZwqEz8BXd-LsqKpXwwvU),第二次构建成功：,  [Agile_L2_sa_lsc_yasft_arm #2437 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/2437/)  |pass|
|4|  [Agile_L2_sa_heap_yasft_arm #2690 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/2690/)  |/plsql_DBMS_external_01/dbms_sql_return_result/test_sdv_return_result_Object_002--rebase最新代码,![](https://pingcode.yasdb.com/atlas/files/public/67396d138970c2af4f52101f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBRUFBQUFBQUFBQUJJQkFBQUFBQkFBQUFFZ0FBQUFBa0FBQUFBQ0FBQUFoQ0FnRUFBRUFBZ0FBZ0VBQUJBQkFBQUFBQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQVVBQUFJSUlBQUFBRUFBQUFFQUFBQUFBQkFBQUFBQUJFQUFFQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU2OTksImV4cCI6MTc4MjMxNjQ5OX0.swn_i8GNUExK_kAyt2b1j-QZwqEz8BXd-LsqKpXwwvU),/plsql_DBMS_external_01/dbms_sql_return_result/test_sdv_return_result_Varray_001--同上rebase最新代码,/plsql_UDT/UDT_VARRAY/6188/test_sdv_var6188_138--报错：when executing test_sdv_var6188_138,the yasdb is not available, yasdb status is open,but need to reconnect,reconnect success，不稳定，跑lastfail,/plsql_UDT/UDT_VARRAY/6188/test_sdv_var6188_202--同上，跑lastfail,/system_view/dynamic_view/test_sdv_ydbrd_15209_03--rebase最新代码,![](https://pingcode.yasdb.com/atlas/files/public/67396d138970c2af4f521020/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBRUFBQUFBQUFBQUJJQkFBQUFBQkFBQUFFZ0FBQUFBa0FBQUFBQ0FBQUFoQ0FnRUFBRUFBZ0FBZ0VBQUJBQkFBQUFBQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQVVBQUFJSUlBQUFBRUFBQUFFQUFBQUFBQkFBQUFBQUJFQUFFQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU2OTksImV4cCI6MTc4MjMxNjQ5OX0.swn_i8GNUExK_kAyt2b1j-QZwqEz8BXd-LsqKpXwwvU),/gis/ST_Collect/gather/test_sdv_YDBRD_22077_ST_Collect_gather_05–重启失败，跑lastfail,第二次构建成功：,  [Agile_L2_sa_heap_yasft_arm #2706 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/2706/)  |pass|
|5|  [Agile_L2_sa_tac_yasft_arm #2315 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/2315/)  |/partition_table/part_cut_data/tac/test_sdv_part_table_select_multi_35_002--排序不稳定，跑lastfail,第二次构建成功：,  [Agile_L2_sa_tac_yasft_arm #2330 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/2330/)  |pass|
|6|  [Agile_L2_sa_HA_heap_driver_c_arm #1430 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_HA_heap_driver_c_arm/1430/)  |rebase最新代码,第二次构建成功：,  [Agile_L2_sa_HA_heap_driver_c_arm #1443 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_HA_heap_driver_c_arm/1443/)  |pass|
|7|  [Agile_L2_sa_heap_driver_python_debug_docker #691 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/691/)  |rebase最新代码,第二次构建成功：,  [Agile_L2_sa_heap_driver_python_debug_docker #704 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/704/)  |pass|
|分布式|  
|  
|  
|
|1|  [Agile_L2_dst_lsc_yasft_arm #1662 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/1662/)  |/DML4/rgd_optimize/ydbrd_29806_rgd_optimize_05,/DML4/rgd_optimize/ydbrd_29806_rgd_optimize_06,/DML4/rgd_optimize/ydbrd_29806_rgd_optimize_07,/DML4/rgd_optimize/ydbrd_29806_rgd_optimize_08–失败原因未知，跑lastfail,![](https://pingcode.yasdb.com/atlas/files/public/67396d13a1ad9a3311dc8e90/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBRUFBQUFBQUFBQUJJQkFBQUFBQkFBQUFFZ0FBQUFBa0FBQUFBQ0FBQUFoQ0FnRUFBRUFBZ0FBZ0VBQUJBQkFBQUFBQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQVVBQUFJSUlBQUFBRUFBQUFFQUFBQUFBQkFBQUFBQUJFQUFFQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU2OTksImV4cCI6MTc4MjMxNjQ5OX0.swn_i8GNUExK_kAyt2b1j-QZwqEz8BXd-LsqKpXwwvU),/system_view/sys_views/lsc/test_sdv_sys_view_dv_desc–rebase最新代码,第二次构建成功：,  [Agile_L2_dst_lsc_yasft_arm #1674 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/1674/)  |pass|
|2|  [Agile_L2_dst_tac_yasft_arm #1574 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/1574/)  |/DDL_01/analyze/analyze/tac/test_sdv_ydbrd20764_statistics_4096--报错：YAS-02182 failed to gather statistics, reason: no free space in virtual memory pool，内存不足，跑lastfail,/system_view/dynamic_view/test_sdv_ydbrd_15209_03–rebase最新代码,/system_view/dynamic_view/test_sdv_ydbrd_15209_04–同上rebase最新代码,/system_view/process/tac/process_dql–失败原因未知，跑lastfail,![](https://pingcode.yasdb.com/atlas/files/public/67396d13a1ad9a3311dc8e91/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBRUFBQUFBQUFBQUJJQkFBQUFBQkFBQUFFZ0FBQUFBa0FBQUFBQ0FBQUFoQ0FnRUFBRUFBZ0FBZ0VBQUJBQkFBQUFBQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQVVBQUFJSUlBQUFBRUFBQUFFQUFBQUFBQkFBQUFBQUJFQUFFQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU2OTksImV4cCI6MTc4MjMxNjQ5OX0.swn_i8GNUExK_kAyt2b1j-QZwqEz8BXd-LsqKpXwwvU),第二次构建成功：,  [Agile_L2_dst_tac_yasft_arm #1591 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/1591/)  |pass|
|3|  [Agile_L2_dst_HA_Switch_docker #2909 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/2909/)  |rebase最新代码,第二次构建：普遍问题，忽略,  [Agile_L2_dst_HA_Switch_docker #2924 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/2924/)  |pass|
|4|  [Agile_L2_dst_tac_driver_jdbc_debug_asan_docker #2902 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_debug_asan_docker/2902/)  |rebase最新代码,第二次构建成功：,  [Agile_L2_dst_tac_driver_jdbc_debug_asan_docker #2907 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_debug_asan_docker/2907/)  |pass|
|集群|  
|  
|  
|
|1|  [Agile_L2_cluster_yasft_cluster_case_arm #2201 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/2201/)  |/system_view/se_event/test_clu_ydbrd29704_01--不稳定，重跑lastfail,![](https://pingcode.yasdb.com/atlas/files/public/67396d13a1ad9a3311dc8e92/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBRUFBQUFBQUFBQUJJQkFBQUFBQkFBQUFFZ0FBQUFBa0FBQUFBQ0FBQUFoQ0FnRUFBRUFBZ0FBZ0VBQUJBQkFBQUFBQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQVVBQUFJSUlBQUFBRUFBQUFFQUFBQUFBQkFBQUFBQUJFQUFFQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU2OTksImV4cCI6MTc4MjMxNjQ5OX0.swn_i8GNUExK_kAyt2b1j-QZwqEz8BXd-LsqKpXwwvU),第二次构建：    [Agile_L2_cluster_yasft_cluster_case_arm #2217 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/2217/)  ,/ddl/profile/test_sdv_profile_idle_time_01_01--不稳定，忽略|pass|
|2|  [Agile_L2_cluster_backup_arm_3 #444 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/444/)  |ha/ha_cluster/testcase/backup/backup_yasrman_xmlfile/test_clu_ydbrd26670_yasrman01.py–ip地址无效，重跑lastfail,ha/ha_cluster/testcase/backup/backup_yasrman_xmlfile/test_clu_ydbrd26670_yasrman02.py–普遍问题，忽略,![](https://pingcode.yasdb.com/atlas/files/public/67396d138970c2af4f521022/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBRUFBQUFBQUFBQUJJQkFBQUFBQkFBQUFFZ0FBQUFBa0FBQUFBQ0FBQUFoQ0FnRUFBRUFBZ0FBZ0VBQUJBQkFBQUFBQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQVVBQUFJSUlBQUFBRUFBQUFFQUFBQUFBQkFBQUFBQUJFQUFFQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU2OTksImV4cCI6MTc4MjMxNjQ5OX0.swn_i8GNUExK_kAyt2b1j-QZwqEz8BXd-LsqKpXwwvU),第二次构建成功（忽略普遍问题）：,  [Agile_L2_cluster_backup_arm_3 #459 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/459/)  |pass|


## Attachments:

[image2024-4-15_16-15-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTJhMWFkOWEzMzExZGM4ZTg3IiwicmVmX2lkIjoiNjczOTZkMTE3MjgyMDZlZmI5MmYxYWQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1Njk5LCJleHAiOjE3ODIzOTIwOTl9.Ro_XjEsvQHvixaNUByQqN7UeyKe9SGEWngzaUtPf-ck)

 (image/png)    


[image2024-4-28_11-43-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTI4OTcwYzJhZjRmNTIxMDFhIiwicmVmX2lkIjoiNjczOTZkMTE3MjgyMDZlZmI5MmYxYWQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1Njk5LCJleHAiOjE3ODIzOTIwOTl9.siY3DVKdqPDvksnwJlUjzb1IHMlWNK3F5RwGBQUzNuk)

 (image/png)    


[集群支持全局block资源dump冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTJhMWFkOWEzMzExZGM4ZThjIiwicmVmX2lkIjoiNjczOTZkMTE3MjgyMDZlZmI5MmYxYWQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1Njk5LCJleHAiOjE3ODIzOTIwOTl9.XTmbbP4yts3-fn-RA3Jir7EXP6YbOXsmeohc_Vgknxc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[集群支持全局block资源dump测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTI4OTcwYzJhZjRmNTIxMDFiIiwicmVmX2lkIjoiNjczOTZkMTE3MjgyMDZlZmI5MmYxYWQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1Njk5LCJleHAiOjE3ODIzOTIwOTl9.kpFmcKlTpl8SYJR0bQcLHA-WHT1XoRtETxkOCsH8LVY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,一、会议时间：2024/4/15 周一 15：00-15：20    
  二、会议地点：腾讯会议    
  三、会议主持人：马爽    
  四、参会人员：陈宜顺、同二鹏、黄杨波、张丽红、马爽    
  五、会议主题：集群支持全局block资源dump测试详细设计评审    
  六、会议总结    
  1、单机下发列存表业务时，需要对比稳态数据和实时数据的block dump信息    
  2、集群下dump的过程中有业务正在写block的场景下，新增写block触发datafile extent扩展时dump场景    
  3、故障场景新增reboot的故障类型    
  4、新增以下测试场景：    
  1）相同的datafile新建之后删除前后dump信息对比    
  2）相同的datafile新建之后修改前后dump信息对比,Posted by mashuang at 四月 15, 2024 16:34|
|---|
