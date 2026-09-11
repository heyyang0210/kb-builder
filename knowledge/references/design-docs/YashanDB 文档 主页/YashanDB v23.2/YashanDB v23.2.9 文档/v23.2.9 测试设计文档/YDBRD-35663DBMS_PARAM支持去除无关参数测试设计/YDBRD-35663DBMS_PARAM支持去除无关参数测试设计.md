# 1.概述

SR链接：  [https://pingcode.yasdb.com/pjm/items/6740536fd6ec4c2fdf76cc3f?](https://pingcode.yasdb.com/pjm/items/6740536fd6ec4c2fdf76cc3f?)  #YDBRD-35663 DBMS_PARAM支持去除无关参数

DBMS_PARAM包目前包含4个子过程/函数，分别是OPTIMIZE、SHOW_RECOMMEND、APPLY_RECOMMEND、SHOW_MEMORY_LIMIT，用于生成数据库的推荐参数；

本次需求优化开发的相关子过程/函数为OPTIMIZE、SHOW_RECOMMEND、APPLY_RECOMMEND，生成推荐参数配置时支持去除无关参数。

# 2.需求分析

## 2.1功能点分析

**DBMS_PARAM.OPTIMIZE**  ：此存储过程用于生成推荐参数，旧的推荐参数将会被覆盖。语法结构如下：

DBMS_PARAM.OPTIMIZE (

	apply_parameter     BOOL,

	table_type          VARCHAR,

	os_memory_limit     NUMBER,

	os_cpu_limit        NUMBER,

	data_path           VARCHAR,

	redo_path           VARCHAR

);该存储过程所有参数都有默认值，可输入参数个数区间为[0,6]

参数描述：

|参数名|描述|是否有默认值|
|---|---|---|
|apply_parameter|生成推荐参数后是否立刻写入配置文件。,设置为TRUE，参数会立即写入配置文件，但还需重启数据库相关参数才能生效；,设置为FALSE，不会写入配置文件|是，FALSE|
|table_type|表类型，可选值为【HEAP、TAC、LSC】|是，HEAP|
|os_memory_limit|内存限制百分比|是，100|
|os_cpu_limit|CPU限制百分比|是，100|
|data_path|datafile所在路径|是，''，系统会自动获取datafile路径|
|redo_path|redofile所在路径|是，''，系统会自动获取redofile路径|


**DBMS_PARAM.SHOW_RECOMMEND**  ：是一个子函数，无输入参数，返回值类型为varchar，返回最近一次推荐参数的报告。语法结构如下：

DBMS_PARAM.SHOW_RECOMMEND();

示例如下：

SELECT DBMS_PARAM.SHOW_RECOMMEND() FROM dual;

其中name表示参数名称，current表示当前数据库配置的参数值大小，recommend表示推荐的参数值，restart表示是否重启生效

![image.png](https://pingcode.yasdb.com/atlas/files/public/675110c7a1ad9a3311de412b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkVBQUFBQUFBQUFBUUFSQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQyNzgsImV4cCI6MTc4MjMzNTA3OH0.S9qIjq2zDH9tSeyCldlFAu-gmyaWitRwGMArisgWTwI)

**DBMS_PARAM.APPLY_RECOMMEND**  ：是一个子过程，无输入参数，表示将最近一次的推荐参数写入配置参数文件中(yasdb.ini)，执行后必须重启数据库才能生效。语法结构如下：

DBMS_PARAM.APPLY_RECOMMEND()

调用时可通过以下3种方式：

EXEC DBMS_PARAM.APPLY_RECOMMEND();

CALL DBMS_PARAM.APPLY_RECOMMEND();

begin

DBMS_PARAM.APPLY_RECOMMEND();

end;

/

**DBMS_PARAM.SHOW_MEMORY_LIMIT：**  是一个子函数，无输入参数，返回值类型为varchar，返回当前配置项下，系统使用内存的上限值。语法结构如下：

DBMS_PARAM.SHOW_MEMORY_LIMIT();

示例如下：

SELECT DBMS_PARAM.SHOW_MEMORY_LIMIT() FROM dual;

其中name表示参数名，setting表示当前数据库参数配置大小，num表示分配的内存资源个数，memory表示参数可使用的内存最大值

![image.png](https://pingcode.yasdb.com/atlas/files/public/67511a99a1ad9a3311de4166/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkVBQUFBQUFBQUFBUUFSQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQyNzgsImV4cCI6MTc4MjMzNTA3OH0.S9qIjq2zDH9tSeyCldlFAu-gmyaWitRwGMArisgWTwI)

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

- 本次需求支持单机、分布式和集群；
- 本次需求涉及的子过程/函数为：OPTIMIZE、SHOW_RECOMMEND、APPLY_RECOMMEND;
- 本息需求涉及的参数配置文件为：yasdb.ini


# 3.详细测试设计

## 3.1测试设计方法

测试设计主要采用等价类和场景法进行设计，等价类设计主要对DBMS_PARAM包本身的通用基础功能点进行验证。

## 3.2详细测试设计

### 3.2.1功能场景设计

|测试场景分类|测试点梳理|测试执行|检查点|
|---|---|---|---|
|DBMS_PARAM包子过程/子函数通用基础功能验证|包含参数校验、关键字校验、子函数返回值校验、高级包调用方式和基本的场景测试,测试设计参考内置高级包功能checklist：  [https://pingcode.yasdb.com/wiki/spaces/ZHANGJIANG/pages/6739bd88593f99c9ff2508b](https://pingcode.yasdb.com/wiki/spaces/ZHANGJIANG/pages/6739bd88593f99c9ff2508bb)  |自动化测试工具：,内置高级包自动生成语句和执行脚本：  [https://pingcode.yasdb.com/wiki/spaces/ZHANGJIANG/pages/6739bd88593f99c9ff2508ae](https://pingcode.yasdb.com/wiki/spaces/ZHANGJIANG/pages/6739bd88593f99c9ff2508ae)  |- 检查数据库状态是否正常，有无core产生；
- 检查数据库是否有异常错误产生
|
|单机HEAP和集群|需保留推荐的参数有：,DATA_BUFFER_SIZE,VM_BUFFER_SIZE,SHARE_POOL_SIZE,MAX_PARALLEL_WORKERS,MAX_SESSIONS,RECOVERY_PARALLELISM|DBMS_PARAM.OPTIMIZE(),![image.png](https://pingcode.yasdb.com/atlas/files/public/6751574ca1ad9a3311de41e8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkVBQUFBQUFBQUFBUUFSQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQyNzgsImV4cCI6MTc4MjMzNTA3OH0.S9qIjq2zDH9tSeyCldlFAu-gmyaWitRwGMArisgWTwI),DBMS_PARAM.SHOW_RECOMMEND(),![image.png](https://pingcode.yasdb.com/atlas/files/public/6751574ca1ad9a3311de41e8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkVBQUFBQUFBQUFBUUFSQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQyNzgsImV4cCI6MTc4MjMzNTA3OH0.S9qIjq2zDH9tSeyCldlFAu-gmyaWitRwGMArisgWTwI),DBMS_PARAM.APPLY_RECOMMEND(),  |【-+++++++++++++检查点一+++++++++++++-】,1.校验DBMS_PARAM.SHOW_RECOMMEND返回值  ：,1）未执行DBMS_PARAM.OPTIMIZE时，调用DBMS_PARAM.SHOW_RECOMMEND则打印"Note: The recommend parameters are not generated. Please execute 'DBMS_PARAM.OPTIMIZE()' first."提示信息，无任何参数相关数据；,2）执行DBMS_PARAM.OPTIMIZE后，再次调用DBMS_PARAM.SHOW_RECOMMEND，需要校验如下返回值信息：,- name：正确显示保留的推荐参数名，其余参数不显示
- current：正确显示当前数据库中配置的保留参数值大小
- recommend：同原有逻辑计算出的推荐值
- restart：同原先值保持不变
- 新增一行名为'other memory'内存统计，位于total memory之上，计算公式为：(total memory) - (show_recommend界面显示的保留参数内存之和)
,,【集群】：,分单机部署和分机部署，单机部署下：,- [x] 需在每个实例上执行DBMS_PARAM.SHOW_RECOMMEND后校验返回值信息   ,- [x] 在相同的data_path和redo_path下，每个实例对应的配置参数返回值数据应相同   ,,【分布式】：,分单机部署和分机部署，单机部署下：,- [x] 需挨个在所有MN、CN和DN节点上执行DBMS_PARAM.SHOW_RECOMMEND后校验返回值信息   ,- [x] 对于CN组，在相同的data_path和redo_path下，每个CN实例对应的配置参数返回值数据应相同   ,- [x] 对于DN组，在相同的data_path和redo_path下，每个CN实例对应的配置参数返回值数据应相同   ,,【-+++++++++++++检查点二+++++++++++++-】,2.校验yasdb.ini配置文件内容  ：,1）调用DBMS_PARAM.OPTIMIZE时，若参数apply_parameter设置为fasle，则yasdb.ini配置文件内容保持不变；,2）未调用DBMS_PARAM.APPLY_RECOMMEND时，yasdb.ini配置文件内容保持不变；,3）若调用DBMS_PARAM.OPTIMIZE(apply_parameter=>True)或者调用了DBMS_PARAM.APPLY_RECOMMEND，则需校验yasdb.ini配置文件内容：,- 若ini文件中保留参数当前值跟推荐值不一致，则更新；若一致，则覆盖；
- ini文件里原先不推荐的参数，调用DBMS_PARAM高级包后，ini文件依旧保留这些不推荐的参数，当前值保持不变；
- 参数当前值跟推荐出来的值一致，若ini文件没有该参数，则不写入ini文件；若ini文件有该参数，则覆盖；
,,【集群】：,分单机部署和分机部署，单机部署下：,- [x] 在多个实例下调用DBMS_PARAM.OPTIMIZE(apply_parameter=>True)或者调用了DBMS_PARAM.APPLY_RECOMMEND后，每个实例应校验yasdb.ini配置文件内容   ,- [x] 若配置了相同的data_path和redo_path，每个实例对应的yasdb.ini文件中生成的推荐参数及其对应值应相同   ,,【分布式】：,分单机部署和分机部署，单机部署下：,- [x] MN节点上调用DBMS_PARAM.OPTIMIZE(apply_parameter=>True)或者调用DBMS_PARAM.APPLY_RECOMMEND后，需校验对应yasdb.ini配置文件内容   ,- [x] CN组每个节点上调用DBMS_PARAM.OPTIMIZE(apply_parameter=>True)或者调用了DBMS_PARAM.APPLY_RECOMMEND后，需在每个CN上校验对应yasdb.ini配置文件内容；若配置了相同的data_path和redo_path，则yasdb.ini配置文件中生成的推荐参数及其对应值应相同   ,- [x] DN组每个节点上调用DBMS_PARAM.OPTIMIZE(apply_parameter=>True)或者调用了DBMS_PARAM.APPLY_RECOMMEND后，需在每个DN上校验对应yasdb.ini配置文件内容；若配置了相同的data_path和redo_path，则yasdb.ini配置文件中生成的推荐参数及其对应值应相同   ,|
||不推荐保留的参数有：,WORK_AREA_STACK_SIZE,WORK_AREA_POOL_SIZE,WORK_AREA_HEAP_SIZE,LARGE_POOL_SIZE,SCOL_DATA_BUFFER_SIZE,SCOL_DATA_PRELOADERS,COLUMNAR_WORK_AREA_HEAP_SIZE,COLUMNAR_VM_BUFFER_SIZE,COLUMNAR_BULK_SIZE,COMPRESSION,PQ_POOL_SIZE,MAX_WORKERS,TAB_QUEUE_WINDOW_SIZE,BLOOM_FILTER_FACTOR,DEGREE_OF_PARALLEL,MMS_DATA_LOADERS,CHECKPOINT_INTERVAL,CHECKPOINT_TIMEOUT,REDOFILE_IO_MODE,DATAFILE_IO_MODE,COMMIT_LOGGING,REDO_BUFFER_SIZE|||
|分布式、单机列存(TAC、LSC)|需保留推荐的参数有：,DATA_BUFFER_SIZE,VM_BUFFER_SIZE,WORK_AREA_POOL_SIZE(单机列存不推荐),WORK_AREA_HEAP_SIZE(单机列存不推荐),SHARE_POOL_SIZE,MAX_PARALLEL_WORKERS,SCOL_DATA_BUFFER_SIZE,SCOL_DATA_PRELOADERS,COLUMNAR_VM_BUFFER_SIZE,COLUMNAR_BULK_SIZE,PQ_POOL_SIZE,MAX_SESSIONS,MAX_WORKERS,TAB_QUEUE_WINDOW_SIZE,BLOOM_FILTER_FACTOR,DEGREE_OF_PARALLEL,RECOVERY_PARALLELISM|||
||不推荐保留的参数有：,WORK_AREA_STACK_SIZE,LARGE_POOL_SIZE,COLUMNAR_WORK_AREA_HEAP_SIZE,COMPRESSION,MMS_DATA_LOADERS,CHECKPOINT_INTERVAL,CHECKPOINT_TIMEOUT,REDOFILE_IO_MODE,DATAFILE_IO_MODE,COMMIT_LOGGING,REDO_BUFFER_SIZE|||
|单机HA(HEAP)|同单机HEAP||分单机部署和分机部署，单机部署下：,- [x] 需在主备节点上执行DBMS_PARAM.SHOW_RECOMMEND后校验返回值信息   ,- [x] 在相同的data_path和redo_path下，主备节点生成的推荐参数及其对应值应相同   ,- [x] 主备节点调用DBMS_PARAM.OPTIMIZE(apply_parameter=>True)或者调用DBMS_PARAM.APPLY_RECOMMEND后，需校验对应yasdb.ini配置文件内容   ,- [x] 若配置了相同的data_path和redo_path，则主备节点对应的yasdb.ini配置文件中生成的推荐参数及其对应值应相同   |
|单机HA(LSC、TAC)|同单机(LSC、TAC)|||
|文档资料测试|SHOW_RECOMMEND示例需更新，描述文字中应体现出"数据仅供参考"字样,示例说明补充如下信息：,- 部署形态
- other memory
|不涉及|资料示例,资料描述|
||SHOW_MEMORY_LIMIT子函数描述应体现出打印的内存"数据仅供参考"字样|不涉及|资料描述|


### 3.2.2特性是否涉及DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具  
(sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：







