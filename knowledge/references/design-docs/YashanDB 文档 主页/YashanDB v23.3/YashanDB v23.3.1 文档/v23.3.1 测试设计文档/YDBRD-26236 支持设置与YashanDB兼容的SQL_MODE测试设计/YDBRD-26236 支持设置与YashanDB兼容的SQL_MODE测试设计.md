Created by 刘立, last modified on 八月 29, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/661900e1fd997db58ad871df](https://pingcode.yasdb.com/pjm/items/661900e1fd997db58ad871df)    ?    
  #YDBRD-26236 支持设置与YashanDB兼容的SQL_MODE

1. 主要实现   NO_ZERO_DATE、NO_ZERO_IN_DATE 支持使用sql_mode设置。yashandb 已包含   NO_ZERO_DATE、NO_ZERO_IN_DATE 支持通过 alter session、alter system 设置。本次实现拉通 alter 和 sql_mode。
1. 其他参数只做兼容，在支持MySQL变量类型的sr中已经实现。


## 1.1相关文档

开发设计：    [【MySQL兼容】支持设置与YashanDB兼容的SQL_MODE设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=162993608)  

其他：    [生态兼容总体设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141579751)  

# 2.   需求分析

## 2.1 功能点分析

1. sql_mode 和 sessionparam 实现联动，修改 sql_mode 时 sessionparam 同步变更，修改 sessionparam 时 sql_mode 不变，实际功能以 sessionparam 生效。


## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

- NO_ZERO_DATE、NO_ZERO_IN_DATE 参数实现效果与之前实现保持一致，与 mysql 的差异点仍然存在。


# 3. 详细测试设计

## 3.1   测试设计方法

1. 对于 sql_mode 设置   NO_ZERO_DATE、NO_ZERO_IN_DATE 的功能测试，主要采用等价类划分等进行测试分析；  sql_mode 与 sessionparam 的联动、多 session 场景、与切换模式交互，主要采用场景法等进行测试分析。


## 3.2   详细测试设计

1、sql_mode 设置    NO_ZERO_DATE、NO_ZERO_IN_DATE

|语句|有效等价类|无效等价类|
|---|---|---|
|- set session sql_mode='';
- set @@session.sql_mode='';
- set local sql_mode='';
- set @@local sql_mode='';
- set global sql_mode='';
- set @@global sql_mode='';
|- 单个参数/多个参数
- 参数值大小写
|- 参数名称不完整
|


2、sql_mode 设置   NO_ZERO_DATE、NO_ZERO_IN_DATE 功能正确生效，语法兼容参数按默认值生效

|配置参数|测试点|备注|
|---|---|---|
|默认值：,NO_ZERO_DATE、NO_ZERO_IN_DATE均生效|执行 dml 操作测试   NO_ZERO_DATE、NO_ZERO_IN_DATE 生效|  
|
|sql_mode 配置同时包含   NO_ZERO_DATE 和 NO_ZERO_IN_DATE|执行 dml 操作测试   NO_ZERO_DATE、  NO_ZERO_IN_DATE 生效|- 每次增加一个参数
- 一次增加多个参数
|
|sql_mode 配置只包含   NO_ZERO_DATE|执行 dml 操作测试   NO_ZERO_DATE生效,NO_ZERO_IN_DATE 不生效|  
|
|sql_mode 配置只包含   NO_ZERO_IN_DATE|执行 dml 操作测试   NO_ZERO_IN_DATE 生效,NO_ZERO_DATE 不生效|  
|
|sql_mode 配置不包含   NO_ZERO_DATE 和 NO_ZERO_IN_DATE|执行 dml 操作测试   NO_ZERO_DATE、NO_ZERO_IN_DATE 均不生效|- 每次减少一个参数
- 一次减少多个参数
|
|STRICT_TRANS_TABLES 默认值为true,ERROR_FOR_DIVISION_BY_ZERO 默认值为true,NO_AUTO_CREATE_USER 默认值为true,NO_ENGINE_SUBSTITUTION 默认值为true,HIGH_NOT_PRECEDENCE 默认值为false,NO_UNSIGNED_SUBTRACTION 默认值为true,PAD_CHAR_TO_FULL_LENGTH 默认值为true,STRICT_ALL_TABLES 默认值为true|验证基本功能按默认值生效|  
|
|修改sql_mode中不包含    
,STRICT_TRANS_TABLES 默认值为true,ERROR_FOR_DIVISION_BY_ZERO 默认值为true,NO_AUTO_CREATE_USER 默认值为true,NO_ENGINE_SUBSTITUTION 默认值为true,HIGH_NOT_PRECEDENCE 默认值为false,NO_UNSIGNED_SUBTRACTION 默认值为true,PAD_CHAR_TO_FULL_LENGTH 默认值为true,STRICT_ALL_TABLES 默认值为true|sql_mode修改成功，实际功能按默认值生效|  
|


3、mysql 兼容模式下 alter session 和 @@session.sql_mode 联动

|场景|子场景|备注|
|---|---|---|
|- 同一会话中使用 @@session.sql_mode 修改 NO_ZERO_DATE 会同步刷新sessionparam
- 同一会话中使用 alter session 修改 NO_ZERO_DATE 时不会刷新 @@session.sql_mode
|1. alter session 修改   NO_ZERO_DATE 为 true
1. @@session.sql_mode   **（包含 NO_ZERO_DATE  且其他参数不变）**
1. alter session 修改   NO_ZERO_DATE 为 false
1. @@session.sql_mode   **（包含 NO_ZERO_DATE  且其他参数不变）**
1. set @@session.sql_mode 删除   NO_ZERO_DATE 
1. V$PARAMETER 视图中  **（NO_ZERO_DATE  值为false）**
1. set @@session.sql_mode 添加   NO_ZERO_DATE 
1. V$PARAMETER 视图中  **（NO_ZERO_DATE  值为true）**
|修改配置后执行一些 dml 操作确认修改生效，具体功能均与   V$PARAMETER 视图中 NO_ZERO_DATE 值保持一致|
|- 同一会话中使用 @@session.sql_mode 修改   NO_ZERO_IN_DATE   会同步刷新sessionparam
- 同一会话中使用 alter session 修改   NO_ZERO_IN_DATE   时不会刷新 @@session.sql_mode
|1. alter session 修改   NO_ZERO_IN_DATE  为 false
1. @@session.sql_mode   **（包含 NO_ZERO_IN_DATE且其他参数不变）**
1. alter session 修改   NO_ZERO_IN_DATE  为 true
1. @@session.sql_mode   **（包含 NO_ZERO_IN_DATE且其他参数不变）**
1. set @@session.sql_mode 删除   NO_ZERO_IN_DATE
1. V$PARAMETER 视图中  **（NO_ZERO_IN_DATE值为false）**
1. set @@session.sql_mode 添加   NO_ZERO_IN_DATE
1. V$PARAMETER 视图中  **（NO_ZERO_IN_DATE值为true）**
|  
|
|@@session.sql_mode 恢复默认值|1. @@session.sql_mode 中删除 NO_ZERO_DATE   和 NO_ZERO_IN_DATE
1. V$PARAMETER 视图中  **（NO_ZERO_IN_DATE和NO_ZERO_IN_DATE值为false）**
1. @@session.sql_mode 恢复默认值
1. V$PARAMETER 视图中  **（NO_ZERO_IN_DATE和NO_ZERO_IN_DATE值为true）**
|  
|


4、mysql 兼容模式下 alter system 和 @@global.sql_mode 联动

|场景|子场景|备注|
|---|---|---|
|- 修改 @@global.sql_mode，sessionparam 同步变化
- alter system 修改   NO_ZERO_DATE 时，@@global.sql_mode 不变，所有会话均以 sessionparam 生效
|1. alter system 修改   NO_ZERO_DATE 为 true，指定 scope=memory
1. @@global.sql_mode   **（值不变）**  ，功能以 true 生效
1. @@session.sql_mode   **（值不变）**  ，功能以 true 生效
1. alter system 修改   NO_ZERO_DATE 为 false，指定 scope=memory
1. @@global.sql_mode   **（值不变）**  ，功能以 false 生效
1. @@session.sql_mode   **（值不变）**  ，功能以 false 生效
1. set @@global.sql_mode 添加   NO_ZERO_DATE 
1. @@session.sql_mode   **（值不变）**  ，功能以 false 生效
1. V$PARAMETER 视图中  **（值不变）**  ，功能以 false 生效
1. set @@global.sql_mode 删除   NO_ZERO_DATE 
1. V$PARAMETER 视图中  **（值不变），功能以 false 生效**
1. @@session.sql_mode   **（值不变），功能以 false 生效**
|  
|
||1. alter system 修改   NO_ZERO_DATE 为 true，指定 scope=spfile
1. @@global.sql_mode   **（值不变）**  ，功能以 true 生效
1. @@session.sql_mode   **（值不变）**  ，功能以 true 生效
1. alter system 修改   NO_ZERO_DATE 为 false，指定 scope=spfile
1. @@global.sql_mode   **（值不变）**  ，功能以 true 生效
1. @@session.sql_mode   **（值不变）**  ，功能以 true 生效
1. set @@global.sql_mode 添加   NO_ZERO_DATE 
1. @@session.sql_mode   **（值不变）**  ，功能以 true 生效
1. V$PARAMETER 视图中  **（值不变）**  ，功能以 true 生效
1. set @@global.sql_mode 删除   NO_ZERO_DATE 
1. V$PARAMETER 视图中  **（值不变）**  ，功能以 true 生效
1. @@session.sql_mode   **（值不变）**  ，功能以 true 生效
|  
|
||1. alter system 修改   NO_ZERO_DATE 为 true，指定 scope=both
1. @@global.sql_mode   **（值不变）**  ，功能以 true 生效
1. @@session.sql_mode  **（值不变）**  ，功能以 true 生效
1. alter system 修改   NO_ZERO_DATE 为 false，不指定 scope
1. @@global.sql_mode   **（值不变）**  ，功能以 false 生效
1. @@session.sql_mode  **（值不变）**  ，功能以 false 生效
1. set @@global.sql_mode 添加   NO_ZERO_DATE 
1. @@session.sql_mode   **（值不变）**  ，功能以 false 生效
1. V$PARAMETER 视图中  **（值不变）**  ，功能以 false 生效
1. set @@global.sql_mode 删除   NO_ZERO_DATE 
1. V$PARAMETER 视图中  **（值不变）**  ，功能以 false 生效
1. @@session.sql_mode   **（值不变）**  ，功能以 false 生效
|  
|
|- 修改 @@global.sql_mode，sessionparam 同步变化
- alter system 修改   NO_ZERO_IN_DATE   时，@@global.sql_mode 不变，所有会话均以 sessionparam 生效
,  
    
|1. alter system 修改   NO_ZERO_IN_DATE   为 true，指定 scope=memory
1. @@global.sql_mode   **（值不变）**
1. @@session.sql_mode   **（值不变）**
1. alter system 修改   NO_ZERO_IN_DATE   为 false，指定 scope=memory
1. @@global.sql_mode   **（值不变）**
1. @@session.sql_mode   **（值不变）**
1. set @@global.sql_mode 添加   NO_ZERO_IN_DATE 
1. @@session.sql_mode   **（值不变）**
1. V$PARAMETER 视图中  **（值不变）**
1. set @@global.sql_mode 删除   NO_ZERO_IN_DATE 
1. V$PARAMETER 视图中  **（值不变）**
1. @@session.sql_mode   **（值不变）**
|  
|
||1. alter system 修改   NO_ZERO_IN_DATE   为 true，指定 scope=spfile
1. @@global.sql_mode   **（值不变）**
1. @@session.sql_mode   **（值不变）**
1. alter system 修改   NO_ZERO_IN_DATE   为 false，指定 scope=spfile
1. @@global.sql_mode   **（值不变）**
1. @@session.sql_mode   **（值不变）**
1. set @@global.sql_mode 添加   NO_ZERO_IN_DATE 
1. @@session.sql_mode   **（值不变）**
1. V$PARAMETER 视图中  **（值不变）**
1. set @@global.sql_mode 删除   NO_ZERO_IN_DATE 
1. V$PARAMETER 视图中  **（值不变）**
1. @@session.sql_mode   **（值不变）**
|  
|
||1. alter system 修改   NO_ZERO_IN_DATE   为 true，指定 scope=both
1. @@global.sql_mode   **（值不变）**
1. @@session.sql_mode   **（值不变）**
1. alter system 修改   NO_ZERO_IN_DATE   为 false，指定 scope=both
1. @@global.sql_mode   **（值不变）**
1. @@session.sql_mode   **（值不变）**
1. set @@global.sql_mode 添加   NO_ZERO_IN_DATE 
1. @@session.sql_mode   **（值不变）**
1. V$PARAMETER 视图中  **（值不变）**
1. set @@global.sql_mode 删除   NO_ZERO_IN_DATE 
1. V$PARAMETER 视图中  **（值不变）**
1. @@session.sql_mode   **（值不变）**
|  
|
|@@  global  .sql_mode 恢复默认值|1. @@  global  .sql_mode 中删除 NO_ZERO_DATE   和 NO_ZERO_IN_DATE
1. V$PARAMETER 视图中  **（NO_ZERO_IN_DATE和NO_ZERO_IN_DATE值不变）**
1. @@global.sql_mode 恢复默认值
1. V$PARAMETER 视图中  **（NO_ZERO_IN_DATE和NO_ZERO_IN_DATE值不变）**
|global.sql_mode中NO_ZERO_DATE 的默认值会在启动实例的时候根据global param的值初始化|
|alter system 修改   NO_ZERO_DATE 后重启实例    
    
|1. alter system 修改 NO_ZERO_DATE 为 false，指定 scope=memory
1. 重启实例
1. 查看@@global.sql_mode  **（@@global.sql_mode恢复默认值，功能以NO_ZERO_DATE 为 true 生效）**
|  
|
||1. alter system 修改 NO_ZERO_DATE 为 false，指定 scope=  spfile
1. 重启实例
1. 查看@@global.sql_mode  **（@@global.sql_mode初始化默认值，不包含**  **NO_ZERO_DATE**  **，功能以NO_ZERO_DATE 为 false 生效）**
|  
|
||1. alter system 修改 NO_ZERO_DATE 为 false，指定 scope=  both
1. 重启实例
1. 查看@@global.sql_mode  **（@@global.sql_mode恢复默认值，功能以NO_ZERO_DATE 为 false 生效）**
|  
|
|alter system 修改   NO_ZERO_IN_DATE   后重启实例    
    
|1. alter system 修改   NO_ZERO_IN_DATE   为 false，指定 scope=memory
1. 重启实例
1. 查看@@global.sql_mode  **（@@global.sql_mode恢复默认值，功能以**  **NO_ZERO_IN_DATE **  **为 true 生效）**
|  
|
||1. alter system 修改   NO_ZERO_IN_DATE   为 false，指定 scope=  spfile
1. 重启实例
1. 查看@@global.sql_mode  **（@@global.sql_mode初始化默认值，不包含**  **NO_ZERO_IN_DATE**  **，功能以**  **NO_ZERO_IN_DATE **  **为 false 生效）**
|  
|
||1. alter system 修改   NO_ZERO_IN_DATE   为 false，指定 scope=  both
1. 重启实例
1. 查看@@global.sql_mode  **（@@global.sql_mode恢复默认值，功能以**  **NO_ZERO_IN_DATE **  **为 true 生效）**
|  
|


5、多会话场景中系统变量和会话变量之间的独立性和正确性，会话均切换到mysql兼容模式

|设置方式|场景|预期结果|
|---|---|---|
|通过 @@global.sql_mode 设置,- 分别测试执行修改的当前会话，修改前创建的会话，修改后创建的会话
- 添加配置与删除配置结果相反
|1、创建2个会话s1、s2    
  2、s1 使用@@global.sql_mode 删除 NO_ZERO_DATE 配置    
  3、s1 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  4、s2 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  5、s1/s2 执行 dml 操作测试 NO_ZERO_DATE 生效    
  6、新建会话s3    
  7、s3 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  8、s3 执行 dml 操作测试 NO_ZERO_DATE 不生效|3、s1 中 @@gloabl.sql_mode 不包含 NO_ZERO_DATE、@@session.sql_mode 包含 NO_ZERO_DATE、  V$PARAMETER 中 NO_ZERO_DATE 为 true    
  4、s2 中 @@gloabl.sql_mode 不包含 NO_ZERO_DATE、@@session.sql_mode 包含 NO_ZERO_DATE、  V$PARAMETER 中 NO_ZERO_DATE 为 true    
  5、NO_ZERO_DATE 正常生效    
  7、s3 中 @@gloabl.sql_mode 不包含 NO_ZERO_DATE、@@session.sql_mode 不包含 NO_ZERO_DATE、V$PARAMETER 中 NO_ZERO_DATE 为 false    
  8、NO_ZERO_DATE 不生效|
||NO_ZERO_IN_DATE 同上|NO_ZERO_IN_DATE 同上|
|通过 alter system 设置,- 分别测试执行修改的当前会话，修改前创建的会话，修改后创建的会话
- 修改为false和修改为true结果相反
|1、创建2个会话s1、s2    
  2、s1 使用 alter system 设置 NO_ZERO_DATE 为 false，指定 scope=memory    
  3、s1 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  4、s2 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  5、s1/s2 执行 dml 操作测试 NO_ZERO_DATE 生效    
  6、新建会话s3    
  7、s3 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  8、s3 执行 dml 操作测试 NO_ZERO_DATE 不生效    
  9、@@session.sql_mode 增加 NO_ZERO_DATE     
  10、@@global.sql_mode 增加 NO_ZERO_DATE，新建会话测试|3、s2 中 @@gloabl.sql_mode 不变、@@session.sql_mode 不变、  V$PARAMETER 中 NO_ZERO_DATE 为 false    
  4、s2 中 @@gloabl.sql_mode 不变、@@session.sql_mode 不变、V$PARAMETER 中 NO_ZERO_DATE 为 false    
  5、NO_ZERO_DATE 不生效    
  7、s3 中 @@gloabl.sql_mode 不变、@@session.sql_mode 不变、V$PARAMETER 中 NO_ZERO_DATE 为 false    
  8、NO_ZERO_DATE 不生效    
  9、V$PARAMETER 同步变更，功能正常生效    
  10、已连接会话不变，新会话 NO_ZERO_DATE 为true，功能正常生效|
||1、创建2个会话s1、s2    
  2、s1 使用 alter system 设置 NO_ZERO_DATE 为 false，指定 scope=  spfile    
  3、s1 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  4、s2 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  5、s1/s2 执行 dml 操作测试 NO_ZERO_DATE 生效    
  6、新建会话s3    
  7、s3 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  8、s3 执行 dml 操作测试 NO_ZERO_DATE 不生效    
  9、@@session.sql_mode 删除 NO_ZERO_DATE     
  10、@@global.sql_mode 删除 NO_ZERO_DATE，新建会话测试    
|3、s2 中 @@gloabl.sql_mode 不变、@@session.sql_mode 不变、  V$PARAMETER 中 NO_ZERO_DATE 为 true    
  4、s2 中 @@gloabl.sql_mode 不变、@@session.sql_mode 不变、V$PARAMETER 中 NO_ZERO_DATE 为 true    
  5、NO_ZERO_DATE 正常生效    
  7、s3 中 @@gloabl.sql_mode 不变、@@session.sql_mode 不变、V$PARAMETER 中 NO_ZERO_DATE 为 true    
  8、NO_ZERO_DATE 正常生效    
  9、V$PARAMETER 变为 false，@@session.sql_mode 中不包含 NO_ZERO_DATE     
  10、已连接会话不变，新会话 NO_ZERO_DATE 为 false，功能正常生效    
|
||1、创建2个会话s1、s2,2、s1 使用 alter system 设置 NO_ZERO_DATE 为 false    
,- 指定 scope=both
- 不指定 scope
,3、s1 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  4、s2 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  5、s1/s2 执行 dml 操作测试 NO_ZERO_DATE 生效    
  6、新建会话s3    
  7、s3 查看@@gloabl.sql_mode、@@session.sql_mode、  V$PARAMETER    
  8、s3 执行 dml 操作测试 NO_ZERO_DATE 不生效    
  9、@@session.sql_mode 增加 NO_ZERO_DATE     
  10、@@global.sql_mode 增加 NO_ZERO_DATE，新建会话测试    
|3、s2 中 @@gloabl.sql_mode 不变、@@session.sql_mode 不变、  V$PARAMETER 中 NO_ZERO_DATE 为 false    
  4、s2 中 @@gloabl.sql_mode 不变、@@session.sql_mode 不变、V$PARAMETER 中 NO_ZERO_DATE 为 false    
  5、NO_ZERO_DATE 不生效    
  7、s3 中 @@gloabl.sql_mode 不变、@@session.sql_mode 不变、V$PARAMETER 中 NO_ZERO_DATE 为 false    
  8、NO_ZERO_DATE 不生效    
  9、V$PARAMETER 同步变更，功能正常生效    
  10、已连接会话不变，新会话 NO_ZERO_DATE 为true，功能正常生效    
|
||NO_ZERO_IN_DATE 同上|NO_ZERO_IN_DATE 同上|


6、修改参数配置和切换 yashan 模式交互

|测试项|场景|预期结果|
|---|---|---|
|修改@@global.sql_mode后会话设置mysql兼容模式和崖山模式|1、创建2个会话s1、s2    
  2、s1 使用@@global.sql_mode 删除 NO_ZERO_DATE 配置    
  3、s2 切换到 yashan 模式    
  4、新建会话 s3 切换到 yashan 模式    
  5、会话 s1 切换到 yashan 模式|3、会话 s2 为mysql兼容模式和yashan模式时 NO_ZERO_DATE 按 true 生效    
  4、会话 s3 为mysql兼容模式和yashan模式时 NO_ZERO_DATE 按 false 生效    
  5、会话 s1 为mysql兼容模式和yashan模式时 NO_ZERO_DATE 按 true 生效|
||NO_ZERO_IN_DATE 同上|  
|
|未使用mysql兼容模式，修改alter session/system param|1、重启实例后未切换过 mysql 兼容模式    
  2、alter session 修改 NO_ZERO_DATE 为 false    
  3、切换为 mysql 兼容模式，查看 sql_mode     
  4、新建会话 s2 切换到 mysql 兼容模式|3、@@session.sql_mode 为默认值，NO_ZERO_DATE 按 true 生效。@@global.sql_mode 为默认值，  V$PARAMETER 中 NO_ZERO_DATE 变为 true。    
  4、会话 s2 切换到 mysql 兼容模式后 @@session.sql_mode 为默认值，NO_ZERO_DATE 按 true 生效,@@session.sql_mode会根据第一次初始化时的global sqlmode进行初始化|
||1、yashan 模式修改 NO_ZERO_DATE 为 false（session级别）    
  2、切换为 mysql 兼容模式    
  3、切换为 yashan 模式    
  4、yashan 模式修改 NO_ZERO_DATE 为 false（session级别）    
  5、切换为 mysql 兼容模式|2、第一次切换为 mysql 兼容模式时 @@session.sql_mode 与 @@global.sql_mode 一致，session param 刷新为与 @@session.sql_mode 一致 NO_ZERO_DATE 为 true    
  3、切换为 yashan 模式 NO_ZERO_DATE 为 true 不变    
  4、修改成功    
  5、第二次切换为 mysql 兼容模式，@@session.sql_mode 不变，包含 NO_ZERO_DATE，session param 不刷新 NO_ZERO_DATE 为 false，功能按 false 生效|
||1、yashan 模式修改 NO_ZERO_DATE 为 false（global级别）    
  2、切换为 mysql 兼容模式    
  3、切换为 yashan 模式    
  4、yashan 模式修改 NO_ZERO_DATE 为 false（global级别）    
  5、切换为 mysql 兼容模式    
  6、新建会话 s2    
  7、会话 s2 切换到 mysql 兼容模式|2、第一次切换为 mysql 兼容模式时 @@session.sql_mode 与 @@global.sql_mode 一致，session param 刷新为与 @@session.sql_mode 一致 NO_ZERO_DATE 为 true    
  3、切换为 yashan 模式 NO_ZERO_DATE 为 true 不变    
  4、修改成功    
  5、第二次切换为 mysql 兼容模式，@@session.sql_mode 不变，包含 NO_ZERO_DATE，session param 不刷新 NO_ZERO_DATE 为 false，功能按 false 生效    
  6、会话 s2 session param 中 NO_ZERO_DATE 为 false     
  7、切换到 mysql 兼容模式 @@session.sql_mode 和 @@global.sql_mode 均包含 NO_ZERO_DATE，session param 刷新为与 @@session.sql_mode 一致 NO_ZERO_DATE 为 true|
||1、重启实例后未切换过 mysql 兼容模式    
  2、alter system 修改 NO_ZERO_DATE 为 false，指定 scope=memory    
  3、切换为 mysql 兼容模式，查看 sql_mode     
  4、新建会话 s2 切换到 mysql 兼容模式,**方案调整为第一次切换mysql兼容模式，@@session.sql_mode 会回刷 session param，这里的测试点和前面 alter session 重复了**|3、@@session.sql_mode 为默认值，NO_ZERO_DATE 按 false 生效。@@global.sql_mode 为默认值    
  4、会话 s2 切换到 mysql 兼容模式后 @@session.sql_mode 为默认值，NO_ZERO_DATE 按 false 生效|
||1、重启实例后未切换过 mysql 兼容模式    
  2、alter system 修改 NO_ZERO_DATE 为 false，指定 scope=  spfile    
  3、切换为 mysql 兼容模式，查看 sql_mode     
  4、新建会话 s2 切换到 mysql 兼容模式|3、@@session.sql_mode 为默认值，NO_ZERO_DATE 按 true 生效。@@global.sql_mode 为默认值    
  4、会话 s2 切换到 mysql 兼容模式后 @@session.sql_mode 为默认值，NO_ZERO_DATE 按 true 生效|
||1、重启实例后未切换过 mysql 兼容模式    
  2、alter system 修改 NO_ZERO_DATE 为 false，指定 scope=both    
  3、切换为 mysql 兼容模式，查看 sql_mode     
  4、新建会话 s2 切换到 mysql 兼容模式|3、@@session.sql_mode 为默认值，NO_ZERO_DATE 按 false 生效。@@global.sql_mode 为默认值    
  4、会话 s2 切换到 mysql 兼容模式后 @@session.sql_mode 为默认值，NO_ZERO_DATE 按 false 生效|
||NO_ZERO_IN_DATE 同上|  
|


7、补充加固   NO_ZERO_DATE、NO_ZERO_IN_DATE 设置为 false 后0值data在函数中的使用（与已测用例不重复）

|系统级DFX分类|是否涉及|
|---|---|
|CT|N|
|KT|N|
|长稳|N|
|一致性|N|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|N|
|压力|N|
|性能|N|
|可维护性|N|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[YDBRD-26236 支持设置与YashanDB兼容的SQL_MODE文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWFhMWFkOWEzMzExZGM5NmRkIiwicmVmX2lkIjoiNjczOTZlNWE3MjgyMDZlZmI5MmYyNzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTQ0LCJleHAiOjE3ODI0NTc5NDR9.HOp30y9wXzb49W-KVc3PXlKLGBrImlx3PH_N1s4pq0M)

# 5. 测试框架设计

- 功能测试使用yasft可以满足需求


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

# 8. 与 mysql 的差异点

不涉及

  


  


## Attachments:

[YDBRD-26236 支持设置与YashanDB兼容的SQL_MODE文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWE4OTcwYzJhZjRmNTIxODZhIiwicmVmX2lkIjoiNjczOTZlNWE3MjgyMDZlZmI5MmYyNzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTQ0LCJleHAiOjE3ODI0NTc5NDR9.u0eaBeluKAGFTMCAcPs7mXdOCQK790RdcnzTR8mnVMc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26236 支持设置与YashanDB兼容的SQL_MODE文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWE4OTcwYzJhZjRmNTIxODZiIiwicmVmX2lkIjoiNjczOTZlNWE3MjgyMDZlZmI5MmYyNzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTQ0LCJleHAiOjE3ODI0NTc5NDR9.g32Ej0Ev_u3O9sgU0ZieV54C5rSf2m3fZj9REwSExgQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26236 支持设置与YashanDB兼容的SQL_MODE文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWFhMWFkOWEzMzExZGM5NmRkIiwicmVmX2lkIjoiNjczOTZlNWE3MjgyMDZlZmI5MmYyNzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTQ0LCJleHAiOjE3ODI0NTc5NDR9.HOp30y9wXzb49W-KVc3PXlKLGBrImlx3PH_N1s4pq0M)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,【会议纪要】,与会人：马士杰、林永豪、张鹏飞、孟麟、刘立    
  会议时间：2024-08-12 11：00 ~ 11：30    
  会议地点：线上    
  腾讯会议：360-556-945    
  纪要信息：,1、补充仅支持语法兼容参数功能生效    
  2、补充NO_ZERO_DATE、NO_ZERO_IN_DATE参数功能场景，在函数中使用    
  3、资料（配置参数部分），关于COMPAT_VECTOR描述存疑，后续资料需要关注优化    
  存疑点：    
  COMPAT_VECTOR仅在会话级生效，如何体现出COMPAT_VECTOR不支持全局配置 alter system    
    [https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%85%8D%E7%BD%AE%E5%8F%82%E6%95%B0.html](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%85%8D%E7%BD%AE%E5%8F%82%E6%95%B0.html)  ,Posted by liuli at 八月 12, 2024 11:38|
|---|
