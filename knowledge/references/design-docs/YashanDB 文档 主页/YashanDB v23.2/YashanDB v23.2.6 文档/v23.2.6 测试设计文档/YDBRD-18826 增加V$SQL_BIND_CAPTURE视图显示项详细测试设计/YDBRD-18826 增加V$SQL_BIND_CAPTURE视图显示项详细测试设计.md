Created by 周彬鑫, last modified on 九月 25, 2024

# 1. 概述

新增v$sql_bind_capture视图实时记录SQL绑定参数具体的值信息。

# 2. 需求分析

## 2.1 功能点分析

- 对v$sql_bind_capture视图原保留字段新增修改


|字段|类型|说明|新增修改|
|:---|:---|:---|:---|
|ADDRESS|RAW(8)|SQL地址|  
|
|CHARACTER_SID|INTEGER|国家/地区字符集标识符  **（保留字段）**|  
|
|CHILD_ADDRESS|RAW(8)|子游标地址|  
|
|CHILD_NUMBER|INTEGER|子游标编号|  
|
|DATATYPE|INTEGER|绑定变量数据类型的内部标识符|  
|
|DATATYPE_STRING|VARCHAR(22)|绑定变量数据类型的文本表示|  
|
|DUP_POSITION|INTEGER|如该绑定变量在SQL中有重复使用，则此列的值设置为首个扫描到的绑定变量的位置  **（保留字段）**|如该绑定变量在SQL中有重复使用，则此列的值设置为首个扫描到的绑定变量的位置  **。**,**显示第一个绑定该参数的位置。**|
|HASH_VALUE|BIGINT|SQL的哈希值，由SQL文本计算得到|  
|
|LAST_CAPTURED|DATE|最近一次捕获绑定变量的时间  **（保留字段）**|绑定参数加载的时间，更新周期受系统参数 _cursor_bind_capture_interval 影响|
|MAX_LENGTH|INTEGER|绑定变量的最大长度|  
|
|NAME|VARCHAR(64)|绑定变量的名称  **（保留字段）**|新增绑定参数变量名称显示，超过限制大小会截断。|
|POSITION|INTEGER|绑定变量在SQL中的位置|  
|
|PRECISION|INTEGER|绑定变量的精度  **（保留字段）**|绑定变量的精度，数值型有效|
|SCALE|INTEGER|绑定变量的范围  **（保留字段）**|绑定变量的范围，数值型有效|
|SQL_ID|VARCHAR(13)|唯一标识一条SQL语句的ID值，具体算法通过SQL文本的哈希/加密运算获得|  
|
|VALUE_STRING|VARCHAR(4000)|绑定变量的值，使用字符串表示  **（保留字段）**|具体绑定参数的内容。超过最大限制的绑定参数会被截断。|
|WAS_CAPTURED|VARCHAR(3)|表示绑定变量的值是否被捕获  **（保留字段）**|表示绑定变量的值是否被捕获（YES/NO）|


- 新增配置参数   _cursor_bind_capture_interval   


## 2.2 应用场景

- 执行绑定参数后 执行 select * from v$sql_ind_capture;


## 2.3 规格约束

**       1、针对于分布式：视图不支持收集dn汇聚上来的。该视图语句不会生成分发到dn的计划。**

**       2、绑定参数只能支持显示简单数据类型，不包括大对象LOB、JSON、XML等**

**       3、oracle文档说明只能支持出现在谓词filter中的绑定参数显示。而yasdb都支持。**

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

*1.使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*

** 绑定参数类型（执行后查视图，验证视图结果**

|测试点|等价类|备注|
|---|---|---|
|绑定参数的数据类型|覆盖全部数据类型,TINYINT；SMALLINT；INT；BIGINT；FLOAT；DOUBLE；NUMBER；BIT、CHAR；VARCHAR；NCHAR；NVARCHAR、BOOLEAN、DATE；TIME；TIMESTAMP；INTERVAL YEAR TO MONTH；INTERVAL DAY TO SECOND、BLOB；CLOB；NCLOB、RAW、JSON、rowid、urowid、UDT、ST_GEOMETRY、XMLTYPE|lob、xml、json、UDT、  ST_GEOMETRY、(raw/urowid?)   不打value_string|
|  
|参数存在类型转换：支持/不支持类型转换|不支持类型转换生成记录？,两类：不支持转换、支持转换但格式不正确|
|绑定参数个数|1个、4096个、4097个|~~边界值4096个？验证一下~~,没有个数限制|
|绑定的位置|filter、投影列、函数|  
|
|绑定参数语句的位置|UDF、UDP、procedure、匿名块|  
|
|  
|DML场景|  
|
|结合参数  _cursor_bind_capture_interval   |修改参数  _cursor_bind_capture_interval   、验证更新时间LAST_CAPTURED字段以及其他字段是否正确更新|  
|
|  
|参数  _cursor_bind_capture_interval边界值？|  
|
|  
|_cursor_bind_capture_interval=0立即刷新/24h 不刷新|  
|
|同一sql 绑定相同/不同类型|绑定相同/不同类型，各字段结果正确|相同类型child_number一致，不同类型child_number不一致|
|绑定的值为NULL/''|不同类型的NULL传参|  
|
|jdbc批量绑定参数|  
|  
|


**视图字段校验**

|测试点|等价类|备注|
|---|---|---|
|DUP_POSITION字段|绑定名称重复 (:1 :1 :1)、为第一个绑定该参数的位置|  
|
|name字段|长度限制64，覆盖长度=64、>64|超过长度限制截断|
|value_string字段|长度限制4k，覆盖长度=4k、>4k|超过长度限制截断|
|  
|varchar 32k 截断|  
|
|WAS_CAPTURED字段|绑定变量的值是否被捕获（YES/NO）|NO的场景？|
|PRECISION、SCALE字段|验证数值类型P、S|  
|
|LAST_CAPTURED字段|结合参数  _cursor_bind_capture_interval    验证：,interval前执行多次,interval前后执行|  
|


**其他**

|测试点|等价类|备注|
|---|---|---|
|极端场景验证|语句包含4096个绑定参数，每个value为4k|执行SQL会报错？,与SHARE_POOL_SIZE/SQL_POOL_SIZE有关|
|关联其他视图查询|关联v$SQL、V$SQLAREA、v$sqltext、V$SQL_PLAN查询|  
|
|open_cursor 外场问题单场景|  
|  
|


测试范围

|测试范围|类型|备注|
|---|---|---|
|部署形态|单机|  
|
|  
|集群|  
|
|  
|分布式|分布式在CN上执行后在CN/DN上查？,child_number跟单机可能有不同？|


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是（interval调为0,大量执行 包含大量淘汰、查询并行）|
|KT|是|
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
|性能|摸底（大量数据，关联其他sql视图查询。对比oracle）|
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
|部署|单机、分布式、集群|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

