Created by 易文亮, last modified on 二月 21, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

*简要说明本功能/需求的背景，本文档的适用范围*

# 2. 需求分析

S R  链接：    [YDBRD-22905](https://jira.yasdb.com/browse/YDBRD-22905?src=confmacro)    -  LSC后台任务执行控制  完成    [YDBRD-21599](https://jira.yasdb.com/browse/YDBRD-21599?src=confmacro)    -  LSC后台任务优化  设计中

开发设计：    [(2) LSC后台任务优化设计文档 - 李子怡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133570049)  

## 2.1 功能点分析

- *YDBRD-22905 导入过程中打断后台任务(转换、合并、清理)*
- *YDBRD-21599 后台资源管控优化、合并策略修改、后台任务视图新增*


## 2.2 应用场景

- *验证非bulkload导入过程中，后台任务能正常执行*
- *验证bulkload导入过程中，后台任务(转换、合并、slice清理)会被打断*
- *验证bulkload导入过程中，手工转换、合并任务会卡住，手工清理任务不影响*
- *验证insert bulload [deduplicate]增量导入过程中，后台任务会被打断*
- *确认OM任务起始时间调度配置是否生效*
- *确认资源管控优化，后台任务是否减少（*  *xfmr的submit模式调整为WORKER_SUBMIT_REUSE*  *）*
- *新的合并逻辑验证*
- *新增系统表字段和功能逻辑验证（*  *TABXFMR$新增字段CREATE_TIME，XFMR_HIS$系统表新增字段*  *）*


## 2.3 规格约束

- *无*


# 3. 详细测试设计

## 3.1 测试设计方法

*对于参数配置主要使用边界值，结合等价类进行验证*

*对于功能逻辑，主要使用场景测试法进行验证*

## 3.2 详细测试设计

1. *后台任务打断功能验证：*


|序号|测试场景|预期|备注|
|---|---|---|---|
|1|构造大量待转换/合并/清理的slice，再执行一段bulkload持续(8min)的导入|导入期间不会产生后台任务|  
|
|2|构造大量待转换/合并/清理的slice，再执行一段非bulkload持续(8min)的导入|导入期间会产生后台任务|  
|
|3|bulkload持续导入大量数据，确认导入过程中是否有后台任务产生，可确认  *XFMR_HIS$视图*|不会产生后台任务|  
|
|4|对表A执行bulkload导入大量数据，对表B执行非bulkload导入大量数据，确认是否有后台任务产生，可确认  *XFMR_HIS$视图*|不会产生后台任务|  
|
|5|合并大量的slice后，bulkload持续导入大量数据，确认是否有后台任务产生，可确认  *garbage_data*|不会产生后台任务|  
|
|6|bulkload持续(8min)的导入期间，尝试手工转换/合并/清理|手工转换/合并会卡住，  *手工清理任务不影响*|  
|


上述bulkload导入包含load data、yasldr、insert /* +bulkload */及insert /* +bulkload deduplicate*/

    2. 资源管控确认

当前启库ps -T -p <pid>会拉起32个XFMR_WORKER线程，默认起8个后台线程，改大配置后线程不够用会创建新的worker

ps -ux | grep 'yasdb' |grep -v 'grep'|awk '{print $2}' |xargs ps -Tp | grep 'XFMR_WORKER'| wc -l

确认默认线程数与配置一致

线程扩缩逻辑验证——15分钟不用缩

构造大量的后台任务，改大改小XFMR_WORKER配置，确认实际后台任务数是否动态变化。

新增配置  **COLUMNAR_MAX_XFMR_MEM_PERCENT**  ，范围【1,100】，默认值100，LSC后台任务占用物化内存百分比，内存生效

相关参数：COLUMNAR_VM_BUFFER_SIZE 取值范围：128MB~2TB， 默认2G；  COLUMNAR_MATERIAL_PERCENT     默认：80

物化内存=COLUMNAR_VM_BUFFER_SIZE*COLUMNAR_MATERIAL_PERCENT/100

LSC后台任务可占用物化内存=  **COLUMNAR_MAX_XFMR_MEM_PERCENT*COLUMNAR_VM_BUFFER_SIZE*COLUMNAR_MATERIAL_PERCENT/100**

资源管控逻辑验证： 验证高压力后台任务业务下查询性能。

    3. 合并逻辑验证

新增配置  SCOL_COMPACT_PRECENT，范围【1,100】，默认值50，代表slice小于sol_slice_rows的50%会自动合并，内存生效

新增配置SCOL_EMPTY_PRECENT，范围【1,100】，默认值100，代表空洞率=被标记删除的记录/slice总的记录数，内存生效

满足2个条件之一则参与合并，未排序的合并逻辑不变。手工合并逻辑和后台自动合并逻辑一致

v$lsc_slice_stat增加字段删除记录数

|序号|测试场景|预期|备注|
|---|---|---|---|
|1|SCOL_COMPACT_PRECENT  参数配置验证，覆盖边界值，无效等价类|逻辑正常|  
|
|2|SCOL_EMPTY_PRECENT参数配置验证，覆盖边界值，无效等价类|逻辑正常|  
|
|3|默认参数下，确认原有合并规则|不影响历史用例预期|无需新增用例|
|4|SCOL_COMPACT_PRECENT分别改小到1%/49%,构造满足和不满足合并条件的slice|合并逻辑正常|验证一个参数时，固定另一个参数,考虑scol_slice_rows很小和默认scol_slice_rows的情形|
|5|SCOL_COMPACT_PRECENT分别改小到51%/100%,构造满足和不满足合并条件的slice|合并逻辑正常|确认slice不会超过scol_slice_rows|
|6|SCOL_EMPTY_PRECENT改为1%/50%/100%，通过delete/update冷数据构造满足和不满足合并的条件|合并逻辑正常|v$lsc_slice_stat的row_counts包含删除的|
|7|验证2个参数的或关系，满足  SCOL_COMPACT_PRECENT，不满足SCOL_EMPTY_PRECENT|会合并，合并逻辑正常|  
|
|8|验证2个参数的或关系，不满足  SCOL_COMPACT_PRECENT，满足SCOL_EMPTY_PRECENT|会合并，合并逻辑正常|  
|
|9|验证2个参数的或关系，满足  SCOL_COMPACT_PRECENT，满足SCOL_EMPTY_PRECENT|会合并，合并逻辑正常|  
|
|10|验证2个参数的或关系，不满足  SCOL_COMPACT_PRECENT，不满足SCOL_EMPTY_PRECENT|不会产生合并任务|  
|


    4. 新增视图验证

#####   [TABXFMR$](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#materialized-view)  

|字段|数据类型|说明|
|:---|:---|:---|
|CREATE_TIME|DATE|后台任务创建时间|


#####   [XFMR_HIS$](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#materialized-view)  

|字段|数据类型|说明|
|:---|:---|:---|
|CREATE_TIME|DATE|后台任务创建时间|
|START_TIME|DATE|后台任务开始时间|
|END_TIME|DATE|后台任务结束时间|
|RUN_DURATION|BINARY_BIGINT|后台任务执行时间（单位s）|
|MEM_COST|BINARY_BIGINT|后台任务内存开销|
|READ_SIZE|BINARY_BIGINT|后台任务读取数据的大小|
|WRITE_SIZE|BINARY_BIGINT|后台任务写入数据的大小|
|swap_size|BINARY_BIGINT|后台任务写入数据的大小|


|序号|测试场景|预期|备注|
|---|---|---|---|
|1|确认    [TABXFMR$](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#materialized-view)    新增了CREATE_TIME字段|字段正确|  
|
|2|##### 确认    [XFMR_HIS$](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#materialized-view)    系统表与字段|字段正确|  
|
|3|视图逻辑验证：构造后台(转换/合并)任务，确认创建时间|创建时间正确|  
|
|4|视图逻辑验证：构造后台(转换/合并)任务，多次bulkload导入打断，再恢复任务，任务执行完成|确认视图内容正确，只有1条,#####   [XFMR_HIS$](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#materialized-view)    记录|  
|
|5|视图逻辑验证：一段时间内合并/转换次数逻辑验证|逻辑正常|  
|
|6|视图逻辑验证：一段时间内合并/转换内存使用逻辑验证|如何计算？|  
|
|7|视图逻辑验证：一段时间内合并/转换读数据量逻辑验证|逻辑正常(转换合并：读>写)|  
|
|8|视图逻辑验证：一段时间内合并/转换写数据量逻辑验证|逻辑正常|  
|
|9|视图逻辑验证：转换合并失败不会生成记录|  
|  
|
|10|系统表变化升级验证|  
|  
|


AC转换任务无记录

延迟清理、归档清理不会被记录

最后一次开始和结束时间

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|Y|
|KT|Y|
|长稳|N|
|一致性|Y|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|Y|
|压力|N|
|性能|Y|
|可维护性|N|


  


# 4. 测试用例

1. 冒烟文本用例:  bulkload增量插入过程中，打断后台任务、bulkload导入过程中，打断后台任务


       2.自动化用例：

[YDBRD22905后台任务优化打断与OM_job测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTBhMWFkOWEzMzExZGM4NjA5IiwicmVmX2lkIjoiNjczOTZiZGY1OTNmOTljOWZmMjM2N2UyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTU3LCJleHAiOjE3ODIzODM5NTd9.UqDvuub-SZA5Z3F1SaTEIpvHNXDdBXqZH1gVax5TnIM)

详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*单机+分布式*

# 7. 工作量评估

工作量：  *6人天*

计划测试完成时间：

## Attachments:

[YDBRD22905后台任务优化打断与OM_job测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTBhMWFkOWEzMzExZGM4NjA5IiwicmVmX2lkIjoiNjczOTZiZGY1OTNmOTljOWZmMjM2N2UyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTU3LCJleHAiOjE3ODIzODM5NTd9.UqDvuub-SZA5Z3F1SaTEIpvHNXDdBXqZH1gVax5TnIM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要,测试设计补充及修改点：,1、bulkload导入过程中，手工合并和转换会因打断后台而卡住,2、后台线程扩缩逻辑确认后需完善验证过程，补充高压业务下配置改大改小对DML性能影响,3、    [XFMR_HIS$](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#materialized-view)    增加字段swap_size，记录换入换出,4、系统表字段变化，需要考虑版本升级,待确认：,后台线程扩缩逻辑,Posted by yiwenliang at 十二月 13, 2023 10:16|
|---|
