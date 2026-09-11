Created by 卢凯舜, last modified on 五月 23, 2024

# 1. 概述

由于目前slice归档存在的问题，进行优化。目前归档存在问题：

1. slice归档大小不纳入归档大小，导致slice归档很大，redo归档很小的情况下，难以触发归档清理（bulkload导入情况下很容易出现）。
1. slice归档跟随redo归档进行清理，但在bulkload情况下，slice所属redo可能很小不转换为归档文件，导致slice归档占用大量磁盘空间释放不了。
1. 为了规避1，2问题，添加了enable_arch_data_ignore_backup配置参数，与当前arch_clean_ignore_mode配置参数割裂。


因此本次设计中，主要针对以上问题进行优化：

1. 将slice大小归纳进归档大小中，从而解决问题1，2。
1. 合并enable_arch_data_ignore_backup与arch_clean_ignore_mode。


# 2. 需求分析

sr链接：    [https://pingcode.yasdb.com/pjm/items/6618f790fd997db58ad85fdd](https://pingcode.yasdb.com/pjm/items/6618f790fd997db58ad85fdd)    ?#YDBRD-26223 归档文件的大小需要包含slice文件的统计

开发文档：    [lsc归档清理优化 - 梁桢灏 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150626914)  

## 2.1 功能点分析

1）ENABLE_ARCH_DATA_IGNORE_BACKUP、ARCH_CLEAN_IGNORE_MODE两个配置项存在重复，需要优化合并

      ARCH_CLEAN_IGNORE_MODE=NONE不忽略，为其他值时会忽略备份，

当前我们库：

- ARCH_CLEAN_IGNORE_MODE：指定清理归档文件时的忽略模式，包括如下值（默认为NONE）：
    - NONE：表示清理归档文件时不忽略备份和备机。
    - BACKUP：表示清理归档时忽略备份，此设置可能导致数据库无法恢复至任意时间点 。
    - STANDBY：表示清理归档时忽略备机，此设置可能导致备机跟不上主机，出现need repair状态，单机部署中默认忽略备机。
    - BOTH：表示清理归档时忽略备份和备机，此设置可能导致如上所述的两种问题均会出现。
    - 其中：
        - 忽略备份指的是无论该归档文件是否已经备份，均会被清理。
        - 忽略备机指的是无论该归档文件是否已经被所有备机获取，均会被清理。
- ENABLE_ARCH_DATA_IGNORE_BACKUP：指定是否清理备份，值为false/true


  
  2）归档大小统计需要包含slice文件的统计

使用sql查看datafile文件大小：  SELECT   NAME, BYTES     /     1024     /     1024     AS   SIZE_MB   FROM   V$DATAFILE;

静态文件大小：select name,used_size from sys.v$databucket;

也可以使用操作系统命令执行统计文件 du -h -s /home/ywl/YASDB_DATA/local_fs/tbs1

3）优化后

合并enable_arch_data_ignore_backup与arch_clean_ignore_mode参数，  将slice大小归纳进归档大小中

1.  archdata线程归档清理lfn是否已推（redo归档达到上限进行归档清理，推动归档lfn）
1.     - 归档清理lfn已推，直接进行归档清理，完成本轮归档清理。
    - 归档清理lfn未推，统计归档大小。

1. 统计归档大小，使用archdatamanager上记录的lfn查询系统表中lfn（该记录lfn是上次统计slice归档大小的最大lfn）
1.     - archdatamanager归档统计状态为Init时，把状态刷新为start，并统计系统表中全量slice文件大小并更新。统计结束后，若状态为start，则改为end，并更新查询最大lfn。若状态为init，则不修改。
    - 若状态为end时，系统表中存在比记录查询最大lfn还大的记录，统计这部分slice的大小增量添加到slice归档大小，并刷新更新查询最大lfn。
    - 不存在比记录lfn更大的slice归档记录时，当前归档大小无需刷新。

1.  archdata线程先判断slice归档大小与redo归档是否达到上限。
1.     - 未达上限，完成本轮归档清理。
    - 达到上限，尝试删除redo归档进行归档删除。

1. 调用主动归档清理接口，尝试删除一个redo归档文件。
1.     - redo归档不满足清理条件，完成本轮归档清理。
    - redo归档满足归档清理，删除一个redo归档。
    - redo不存在归档，进行日志切换，尝试生成归档，再尝试删除一个redo归档，若删除失败，完成本轮归档清理。

1. 使用推动的lfn进行归档删除，归档删除结束后把archdatamanager归档统计状态设置为Init。完成本次归档清理


## 2.2 应用场景

归档模式下，SLICE即作为数据文件又作为REDO文件，因此SLICE不会被真正删除。  这样归档后的SLICE在归档清理时无法清理导致磁盘无法回收，占用资源，slice归档大小不纳入归档大小，导致slice归档很大，redo归档很小的情况下，难以触发归档清理，本需求主要涉及清理识别到slice文件加上redo比maxsize大会触发归档清理的条件。

## 2.3 规格约束

- *内部机制涉及的规格约束*


# 3. 测试设计方法 

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

*1)使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*

*语法测试*

|输入条件||有效等价类|编号|无效等价类|编号|
|:---|---|:---|:---|:---|:---|
|  
|  
|  
|  
|  
|  
|


基本场景

|测试场景||
|:---:|---|
|需要走归档清理的基本场景|SLICE被COMPACT合并|
|  
|drop column 单列/多列|
|  
|drop table,drop 后再创建同名对象|
|  
|truncate table|
|  
|drop tablespace 删除databucket表空间,drop 后再创建同名对象|
|  
|drop database|
|  
|删除SLICE    
  ALTER TABLE table_name ALTER SLICE ALL CLEAN [ ASYNC ]|
|  
|分区表drop 分区    
  drop 后再创建同名对象|
|  
|drop AC     
  DROP ACCESS CONSTRAINT xx    
  表上建有AC,COMPACT、drop table,drop column,truncate table等    
  drop 后再创建同名对象|
|  
|分区表truncate 分区|
|  
|alter tablespace drop databucket    
  需要先drop table|
|  
|DML 不走归档清理|
|部署形态、表类型|单机/分布式|
|  
|lsc/ tac/heap?|
|  
|普通表/分区表/二级分区表,hash    
  list    
  range    
  interval|
|  
|  
|


场景测试

|序号|测试场景||预期|备注|
|:---:|:---:|---|:---:|:---:|
|  
|单机场景下，构造slice与redo清理场景|1.打开归档模式，开启自动归档清理,2.构造部分的slice废弃文件，归档文件+slice大小小于ARCH_CLEAN_UPPER_THRESHOLD，查询视图,3.切换redo，不触发自动归档清理,4.继续构造slice废弃文件，超过ARCH_CLEAN_UPPER_THRESHOLD，触发自动清理,5.查询对应视图，确认是否真的有统计废弃slice，以及对应文件是否废弃|  
|slice废弃文件覆盖上述基础场景|
|  
|  
|较大redo和较小slice文件，触发自动归档清理，查询对应视图|  
|  
|
|  
|  
|手动归档清理后，重新构造自动清理场景|  
|  
|
|  
|  
|手动删除部分归档文件，再构造slice文件，触发归档清理|手动删除归档会比较慢|  
|
|  
|  
|手动删除部分slice、archlog|  
|删除大小|
|  
|  
|归档 --非归档--归档 非归档期间产生的能够正常清理|  
|  
|
|  
|HA归档清理场景|主备ARCH_CLEAN_IGNORE_MODE 参数,ARCH_CLEAN_IGNORE_MODE 参数,NONE:HA默认 不忽略备份和备机,BACKUP：忽略备份,STANDBY：忽略备机,BOTH：忽略备份和备机，可能造成need repair,覆盖不同参数下测试上述场景|  
|主机只清理小于所有备机rcy_point起始点的归档；备机只清理小于所有级联备起始点的归档|
|  
|  
|如果主机设置maxsize较大，备机设置较小|备机达到上限后，若slice处于redo中，无法触发日志切换来进行归档清理。|  
|
|  
|  
|主机设置maxsize较小，备机设置较大|正常执行业务|  
|
|  
|  
|HA，自动归档清理，slice文件能够正常清理  反复构造slice，COMPACT|  
|  
|
|  
|  
|主备配置相同，清理主机，主备同步后确认备机与主机一致|  
|  
|
|  
|分布式归档清理场景|复制表    
  各个DN上一样的slice文件，满足条件都会清理|  
|  
|
|  
|  
|分布表    
  数据和slice归档分布在不同的DN，满足条件都会清理|  
|  
|
|  
|  
|异常场景 一个DN异常|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


*涉及DFX测试*

|序号|测试场景||预期|备注|
|:---:|:---:|---|:---:|:---:|
|  
|CT/KT|构造大量归档后手工清理|  
|  
|
|  
|  
|KT: 清理过程中重启|  
|  
|
|  
|  
|CT: 归档清理+COMPACT+DDL（drop table,create table,drop column,truncate table等）+DML +删除slice|  
|  
|
|  
|升级|低版本构造部分业务,升级后构造较大slice文件废弃，触发归档清理|  
|因为新增归档清理大小，原已有归档为0，暂不统计,升级后建的表有归档，不统计升级前的|


*2)*  *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
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
|性能|  
|
|可维护性|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


## Comments:

|  [](null)  ,会议纪要    
  一、会议时间：2024/05/15 周三 14:30-15:00    
  二、会议地点：26栋1002    
  三、会议主持人：卢凯舜    
  四、参会人员：易文亮、黄文早、梁桢灏    
  五、会议主题：《    [归档文件的大小需要包含slice文件的统计测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=153000733)    评审》    
  六、会议总结    
  测试补充点：    
  1、  手动删除部分slice、archlog后，触发自动清理，注意触发自动清理时对应redo和slice的大小    
  2、补充  主备配置相同时，清理主机，并主备同步的场景，确认同步后备机与主机一致    
  3、补充升级场景，确认升级后建表的表能够统计到,Posted by lukaishun at 五月 15, 2024 16:35|
|---|
