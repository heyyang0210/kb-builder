Created by 高亚宁, last modified by  易文亮 on 四月 23, 2024

# 1.   **概述**

-   [1. 概述](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-1.概述)  
-   [2. 需求分析](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-2.需求分析)  
    -   [2.1 SR：profile支持IDLE_TIME和SESSIONS_PER_USER功能项](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-2.1SR：profile支持IDLE_TIME和SESSIONS_PER_USER功能项)  
    -   [2.2 SQL语法](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-2.2SQL语法)  
    -   [2.3 参数规格](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-2.3参数规格)  
    -   [2.4 相关视图](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-2.4相关视图)  
-   [3. 测试设计方法 ](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-3.测试设计方法)  
    -   [3.1 特性关联领域分析：](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-3.1特性关联领域分析：)  
    -   [3.2 测试设计：](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-3.2测试设计：)  
-   [4. 详细测试设计](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-4.详细测试设计)  
    -   [4.1 语法](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-4.1语法)  
    -   [4.2 功能](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-4.2功能)  
    -   [4.3 dba_profiles视图](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-4.3dba_profiles视图)  
    -   [4.4 profile权限](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-4.4profile权限)  
    -   [4.5 资料测试](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-4.5资料测试)  
-   [5. 测试用例设计](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-5.测试用例设计)  
-   [6. 测试框架设计](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-7.测试环境说明)  
-   [8. 工作量说明](#id-【YDBRD29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项测试设计-8.工作量说明)  


本文描述  profile支持IDLE_TIME和SESSIONS_PER_USER功能项的  测试设计。

# 2.   **需求分析**

### 2.1 SR：profile支持IDLE_TIME和SESSIONS_PER_USER功能项

链接：       [YDBRD-29796](https://jira.yasdb.com/browse/YDBRD-29796?src=confmacro)    -  profile支持IDLE_TIME和SESSIONS_PER_USER功能项  设计中

设计文档：    [Profile会话限制](147779832.html)  

需求描述：

1.   profile支持IDLE_TIME和SESSIONS_PER_USER功能项

a. IDLE_TIME 允许空闲会话的时间，单位是分钟，默认无限制    
  b. SESSIONS_PER_USER 每个用户名所允许的并行会话数，默认无限制

需求范围：  单机和集群

相关功能测试设计：    [profile测试设计（password parameter）](https://conf.yasdb.com/pages/viewpage.action?pageId=147776846)  

### 2.2 SQL语法

  


CREATE/ALTER PROFILE profile_name LIMIT IDLE_TIME|SESSIONS_PER_USER <integer>;

DROP   PROFILE profile_name [CASCADE];

profile限制赋权给user关联语法

create/alter user u1 profile profileName;

### 2.3 参数规格

1. sessions_per_user限制一个用户可以同时发起的会话上限，配置值为[1, 2147483646]的整数
1. idle_time限制用户会话最长的空闲无操作时间，服务端将巡检如果某个会话超过限制时间无操作，将会断开该链接释放会话资源。 idle_time配置值单位为分钟，取值为[1, 2147483646]的整数值。
1. 该需求的目的是限制用户对会话资源的滥用，sys用户为超级管理员用户，不受对应约束。（和oracle一致）


### 2.4 相关视图

**dba_profiles**

|字段|Null? |Type|说明|
|---|---|---|---|
|PROFILE|NOT NULL|VARCHAR2(128)|  
|
|RESOURCE_NAME|NOT NULL|VARCHAR2(32)|  
|
|RESOURCE_TYPE|  
|VARCHAR2(8)|  
|
|LIMIT|  
|VARCHAR2(128)|  
|


**视图会新增resource_name为**  **IDLE_TIME和SESSIONS_PER_USER的记录，type=KERNEL，LIMIT=DEFAULT**

**default profile**

select * from dba_profiles where PROFILE = 'DEFAULT' and resource_name in('  IDLE_TIME  ','  SESSIONS_PER_USER  ');

select username,profile from dba_users where username='USER_NAME';

资源项系统表RESOURCE_MAP$、PROFILE$

# 3.   **测试设计方法**   

### 3.1 特性关联领域分析：

1. 视图：dba_profiles，确认profile是否与创建/修改指定的一致
1. create/alter/drop profile语法及功能是否生效
1. create/alter user u1 profile profileName语法及功能是否生效
1. 并发：create之间的并发，alter之间的并发
1. 内存泄漏：反复create/alter/drop profile，查询V$DICT_CACHE视图，不会出现内存泄漏
1. ha场景：备机可查询，但创建报错，修改的profile在备机上生效
1. 规格：profile数量上限10k 


### 3.2 测试设计：

主要采用  场景法和错误推测法进行设计

1. 语法验证：采用等价类和边界值法，针对语法进行覆盖，主要验证profile语法是否正常，报错是否明确
1. 功能验证：触发profile限制，受限及受限后的表现，改大改小profile，采用场景法，异常场景结合错误推测法
1. 结合数据库的session相关参数MAX_SESSIONS=1024和操作系统参数open files=1048576/max user processes=65535


|系统级DFX分类|是否涉及|备注|
|:---|:---|---|
|CT|Y|  
|
|DFR|N|已有看护，本次只是新增参数|
|HA|Y|  
|
|KT|Y|  
|
|一致性|N|资源与事务无关|
|三方测试工具    
  (sqltest，sqlancer)|N|  
|
|压力|N|  
|
|可维护性|N|  
|
|安全|N|  
|
|性能|N|  
|
|长稳|N|  
|


# 4.   **详细测试设计**

### 4.1 语法

|模块|输入条件|有效等价类|无效等价类|备注|
|---|:---|:---|:---|:---|
|create profile|~~profile名称~~|名称正常输入、包含特殊字符|名称使用特殊字符、数字开头|  
|
|  
|  
|名称长度64位|名称长度超过64位|  
|
|  
|  
|  
|名称使用标识符报错|  
|
|  
|  
|  
|名称为空、空串|  
|
|  
|  
|  
|名称重复|  
|
|  
|~~profile，limit，Resource_parameters，expr等参数~~|多个密码参数组合|profile缺失|  
|
|  
|  
|关键字大小写混合|limit缺失|  
|
|  
|  
|Resource_parameters大小写混合|Resource_parameters缺失|  
|
|  
|  
|  
|expr、unlimited、default等缺失|  
|
|  
|  
|  
|SESSIONS_PER_USER/IDLE_TIME重复|  
|
|  
|SESSIONS_PER_USER|设置为1|设置为0|【1，2147483646】  单位为个,正整数|
|  
|  
|设置为2147483646，3.0（成功）|设置为2147483647|  
|
|  
|  
|  
|设置为小数1.5|  
|
|  
|  
|  
|设置字符串abc、'abc'、*|  
|
|  
|  
|unlimited大小写混合|unlimited/default拼写错误|  
|
|  
|  
|default大小写混合|expr和unlimited/default同时使用|  
|
|  
|  
|设置为表达式（函数、算数）计算后在范围内|设置为表达式（函数、算数）计算后在范围外|  
|
|  
|IDLE_TIME|设置为1|设置为0,  设置为2147483647|【1，2147483646】  单位为分钟,正整数|
|  
|  
|设置为2147483646|设置为小数1.5|  
|
|  
|  
|3.0（成功）|设置字符串abc、'abc'、*|  
|
|  
|  
|unlimited大小写混合|unlimited/default拼写错误|  
|
|  
|  
|default大小写混合|expr和unlimited/default同时使用|  
|
|  
|  
|设置为表达式（函数、算数）计算后在范围内|设置为表达式（函数、算数）计算后在范围外|  
|
|alter profile|/|修改expr的值|名称不存在|  
|
|  
|  
|修改为default|修改expr为超范围的非法值|  
|
|  
|  
|修改为unlimited|profile，limit，Password_parameters，expr等关键字缺失或写错|  
|
|  
|  
|修改default profile|  
|  
|
|~~drop profile~~|/|正常删除|名称不存在|  
|
|  
|  
|带cascade（未关联user时）|关联user时，不带cascade|  
|
|  
|  
|不带cascade（未关联user时）|删除Default profile|  
|
|  
|  
|关联user时，带cascade|  
|  
|
|  
|  
|删除profile后，校验user对应的profile限制不生效|  
|  
|
|~~create user u1 profile profileName.~~|create user u1 profile profileName.|正常输入|user已存在|  
|
|  
|  
|  
|profileName不存在|  
|
|  
|  
|  
|profile关键字写错|  
|
|  
|  
|一个profile关联多个用户|和多个profile关联|  
|
|~~alter user u1 profile profileName.~~|alter user u1 profile profileName.|正常修改|user不存在|  
|
|  
|  
|  
|profileName不存在|  
|
|  
|  
|  
|profile关键字写错|  
|


### 4.2 功能

|序号|测试场景|部署模式|备注|
|:---|:---|---|:---|
|1|create profile profile_YDBRD28097 limit   **SESSIONS_PER_USER**   3，关联user1，使用该用户，开启3个会话成功，开启第4个会话时报错，改大profile限制后，开启第4个会话成功,4个会话能正常执行业务|单机+集群|  
|
|2|create profile profile_YDBRD28097 limit   **SESSIONS_PER_USER**   3，关联user1，使用该用户，开启3个会话成功，开启第4个会话时报错，user修改指定为一个更大的profile后，开启第4个会话成功，正常执行 （退出部分会话，再新增会话能成功，超过会触发限制）|单机+集群|  
|
|3|create profile profile_YDBRD28097 limit   **SESSIONS_PER_USER**   3，关联user1，使用该用户，开启3个会话成功，开启第4个会话时报错，改小profile限制后，开启新会话失败，已存在的会话业务不受影响|单机+集群|  
|
|4|create profile profile_YDBRD28097 limit   **SESSIONS_PER_USER**   3，关联user1，使用该用户，开启3个会话成功，开启第4个会话时报错，user修改指定为一个更小的profile后，开启新会话失败，已存在的会话业务不受影响|单机+集群|  
|
|5|create profile profile_YDBRD28097 limit   **SESSIONS_PER_USER**   1024，关联user1|单机+集群|  
|
|6|alter profile limit   **SESSIONS_PER_USER**   default，关联user1，尝试user1开启好会话成功，触发max_session后报错|单机+集群|默认unlimited|
|7|alter profile limit   **SESSIONS_PER_USER**  unlimited  ，关联user1，尝试user1开启好会话成功，触发max_session后报错|单机+集群|  
|
|8|create profile profile_YDBRD28097 limit   **IDLE_TIME**   n，关联user1，使用该用户连接会话成功，闲置n分钟后尝试执行业务，正常提示断开连接(n=1/60/1440/..),延伸场景1：idle_time 1分钟，会话闲置50s，执行sql业务，再闲置20s，执行sql业务确认会话连接情况，不断连,延伸场景2：idle_time 1分钟，会话闲置50s，执行shell命令，再闲置20s，执行sql业务确认会话连接情况，断连，确认未提交事务被回滚；改大idle_time, 再次尝试执行业务，仍然断连，开启新会话，空闲断连时间按适应新配置，确认断连session和cursor资源会被释放,延伸场景3：idle_time 1分钟，会话闲置70s，执行sql业务确认会话连接情况，断连，确认未提交事务被回滚；修改user指定到更大的idle_time, 再次尝试执行业务，仍然断连，开启新会话，空闲断连时间按适应新配置，确认断连session和cursor资源会被释放,延伸场景4：idle_time 10分钟，会话闲置5m，再改大为20m，再闲置6分钟，尝试执行sql断连（集群切多实例操作）,                    idle_time 10分钟，会话闲置5m，再改小为6m，再闲置2分钟，尝试执行sql不断连（集群切多实例操作）,                    idle_time 10分钟，会话闲置5m，再改小为4m，再闲置11s，尝试执行sql不断连（集群切多实例操作）|单机+集群|断连会在alert.log生成告警记录|
|9|create profile profile_YDBRD28097 limit   **IDLE_TIME**   n，关联user1，使用该用户连接会话成功，执行业务成功，闲置n分钟后再尝试执行业务，正常提示断开连接(n=1/60/1440/..)|单机+集群|  
|
|10|create profile profile_YDBRD28097 limit   **IDLE_TIME**   default，关联user1，使用该用户连接会话成功，闲置n分钟后尝试执行业务，不会断开能正常执行|单机+集群|默认unlimited|
|11|create profile profile_YDBRD28097 limit   **IDLE_TIME**  unlimited  ，关联user1，使用该用户连接会话成功，闲置n分钟后尝试执行业务，不会断开能正常执行|单机+集群|  
|
|12|create profile limit 多种参数都限制，全部生效。如果超过密码重试次数限制和用户会话数限制，报错密码被锁；如果同时密码过期和超过用户会话数限制，报错超用户会话数                                                   |单机+集群|  
|
|13|alter profile limit 多种参数都修改，全部生效|单机+集群|  
|
|14|**IDLE_TIME**  和  **SESSIONS_PER_USER**  ，全部设置为  unlimited，不限制|单机+集群|  
|
|15|**IDLE_TIME**  和  **SESSIONS_PER_USER**  ，全部设置为  某个值，2个限制都生效|单机+集群|  
|
|16|user会话数超过  **SESSIONS_PER_USER**  后无法新增会话，改大  **SESSIONS_PER_USER**  ，配置立即生效，不超过配置新增会话可以成功|单机+集群|  
|
|17|user会话空闲时间超过  **IDLE_TIME**  后断连无法执行业务，改大  **IDLE_TIME**  ，仍然无法执行业务，新的会话空闲断连时间以新配置为准|单机+集群|  
|
|18|给sys用户赋予带有  **SESSIONS_PER_USER**  限制的profile，使用sys用户不断新增会话，确认是否受限，不受限制|单机+集群|  
|
|19|给sys用户赋予带有  **IDLE_TIME**  限制的profile，使用sys用户开启会话，空闲等待，确认是否受限，不受限制|单机+集群|  
|
|20|集群  **SESSIONS_PER_USER**  限制为多个实例同一用户的会话连接数相互独立，都为限制值|集群|  
|
|21|**IDLE_TIME**  限制对集群多实例的user都生效|集群|  
|
|22|集群实例1创建profile赋权给user1，实例2修改后实例1、2确认配置及功能限制|集群|  
|
|23|用户使用  **IDLE_TIME**  为1的profile，执行长SQL(执行时长大于1分钟)，中途不会出现断连，之后可以正常执行业务；执行长shell(执行时长大于1分钟)，中途不会出现断连，再执行业务提示断连|单机+集群|  
|
|24|不同客户端限制验证|单机+集群|  
|
|28|并发：create之间的并发，alter之间的并发，自建用户验证|  
|  
|
|29|内存泄漏：反复create/alter/drop profile，查询V$DICT_CACHE视图，不会出现内存泄漏|  
|  
|
|30|ha场景：主机创建的profile，在备机可查询且能够生效|HA+集群HA|  
|
|31|ha场景：主备各节点之间的会话连接相互独立，都不超过限制值则可正常连接|HA+集群HA|  
|
|32|~~ha场景：在主机上修改的profile，在备机上查询修改成功，且生效~~|  
|  
|
|33|~~ha场景：在备机上create/alter/drop报错~~|  
|  
|
|34|~~ha场景：备机switchover/failover后，create/alter/drop成功~~|  
|  
|
|35|升级场景：22.2--->23.2版本升级后，profile依然有效|  
|  
|
|  
|连接会话数超过  **SESSIONS_PER_USER**  会话限制，会报错|  
|  
|
|  
|会话连接闲置时间超过  **IDLE_TIME**  限制，session断连|  
|  
|


### 4.3 dba_profiles视图

|序号|测试场景|预期结果|备注|
|:---:|:---|:---|:---|
|1|确认profile='default'的结果集|增加资源项  **SESSIONS_PER_USER/**  **IDLE_TIME,TYPE=KERNEL,LIMIT=DEFAULT**|  
|
|2|创建profile限制  **SESSIONS_PER_USER，查询视图**|视图有记录，且内容与限制的值一致，未指定的都是default|  
|
|3|创建profile限制  IDLE_TIME  **，查询视图**|视图有记录，且内容与限制的值一致，未指定的都是default|  
|
|4|创建profile同时限制  IDLE_TIME、  **SESSIONS_PER_USER，查询视图**|视图有记录，且内容与限制的值一致，未指定的都是default|  
|
|5|修改profile只指定  IDLE_TIME或  **SESSIONS_PER_USER一项，查询视图**|视图内容跟修改后的一致，指定的项被修改，未指定的不变|  
|
|6|修改profile同时指定  IDLE_TIME、  **SESSIONS_PER_USER两项，查询视图**|视图内容跟修改后的一致，指定的项被修改，未指定的不变|  
|


### ~~4.4 profile权限~~

|序号|测试场景|备注|
|:---:|:---|:---|


### 4.5 资料测试

新增profile语法，create/alter user中新增profile选项，dba_users中新增profile字段

profile权限的语法说明

# 5.  ** **  **测试用例设计**

[PROFILE_YDBRD29796测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmQ4OTcwYzJhZjRmNTIwZTIwIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.XWOWseSFvSk7qDnKT1PGDukkO2hAawCi9BtTvZgbKjY)

# 6.   **测试框架设计**

采用Guider框架，ha部分使用ha_regress框架，并发场景使用testkill框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机+HA+集群|


# 8. 工作量说明

10人天

## Attachments:

[profile.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmM4OTcwYzJhZjRmNTIwZTFiIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.fRUBoHNAmwJRl0imwA8jR_i8j69GLSCUxjWF3onwZmQ)

 (application/vnd.ms-excel)    


[image2022-12-26_9-57-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmM4OTcwYzJhZjRmNTIwZTFjIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.Ay5x4j7uK5x_bsyUsvtAbDQs0S0rIaa3HuFkTxaTRow)

 (image/png)    


[image2022-12-26_9-54-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmRhMWFkOWEzMzExZGM4YzhjIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.-msMIWcKRu0bVzAdKcRZOoy43RiwoBil5_ZUnkBLT34)

 (image/png)    


[image2022-12-13_11-20-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmQ4OTcwYzJhZjRmNTIwZTFkIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.EMnIDHkt4ikwqP-DOnFofoCvKQYzkx8wGMAtHsiUdt4)

 (image/png)    


[image2022-12-13_11-19-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmQ4OTcwYzJhZjRmNTIwZTFlIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.LoZ5GgMej3eQ6ahAFJzyqJTUQKYrEvIBCwlwS-W-1Pg)

 (image/png)    


[image2022-6-8_17-42-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmRhMWFkOWEzMzExZGM4YzhkIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.jE4CUQ_-4TpXM7JU0fBTvKyF5TNqSxHVf4GPYr_Bc_o)

 (image/png)    


[image2022-6-8_17-42-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmRhMWFkOWEzMzExZGM4YzhlIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.gAqZGlfqq-y8xtBJ9w49JTzFV-wvJPri4bXNU3By140)

 (image/png)    


[image2022-10-19_10-28-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmRhMWFkOWEzMzExZGM4YzhmIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.hacvkOjPv4h45953WVot_Am5wSJyQ0bwZQMlHN6HZ7Y)

 (image/png)    


[profile_ydbrd28097.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmQ4OTcwYzJhZjRmNTIwZTFmIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.l32ghfXQ6Geu0mPqYmqM7gHlCh2DndqVAxIy9-XxTew)

 (application/vnd.ms-excel)    


[PROFILE_YDBRD29796测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmQ4OTcwYzJhZjRmNTIwZTIwIiwicmVmX2lkIjoiNjczOTZjYmM1OTNmOTljOWZmMjM3Mjc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDg4LCJleHAiOjE3ODIzODk0ODh9.XWOWseSFvSk7qDnKT1PGDukkO2hAawCi9BtTvZgbKjY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：,主题：profile支持IDLE_TIME和SESSIONS_PER_USER测试设计评审,参会人：张志鹏、李燕琼、高亚宁、易文亮,1）注明用例执行环境,2）考虑使用不同客户端进行会话验证,3）补充退出部分会话后再新增  **SESSIONS_PER_USER的表现**,4）集群考虑跨实例修改profile后，多实例受限场景,5）补充会话空闲一段时间后，改大或改小空闲限制，再闲置确认表现，当前认为以新配置为准，集群考虑切多实例操作(具体调研对标oracle),6）并发场景需要关联用户，用户连接session，确认资源使用/释放,Posted by yiwenliang at 四月 11, 2024 11:27|
|---|
|  [](null)  ,5）先开启会话，再修改profile，以开启会话时的配置为准，新配置不生效——oracle表现,Posted by yiwenliang at 四月 11, 2024 20:58|
