Created by 罗爽, last modified on 六月 04, 2024

# 1. 概述

DBMS_SESSION是数据库管理系统（DBMS）中的一个模块，它支持会话级别的上下文管理。  本文描述DBMS_SESSION高级包的测试设计。

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/66276a74fd997db58adfd1e4](https://pingcode.yasdb.com/pjm/items/66276a74fd997db58adfd1e4)    ?    
  #YDBRD-26617 支持DBMS_SESSION高级包

开发设计文档：    [YDBRD-26617 支持DBMS_SESSION高级包](153005926.html)  

1）测试范围：

- DBMS_SESSION.SET_IDENTIFIER                                  #   设置客户端标识符
- DBMS_SESSION.CLEAR_IDENTIFIER                             #   清除客户端标识符
- DBMS_SESSION.FREE_UNUSED_USER_MEMORY         # 仅兼容，无实际作用
- v$session增加client_identifier字段


2）规格约束

- client_identifier的最大长度为64，超过该长度则报错
- DBMS_SESSION.FREE_UNUSED_USER_MEMORY 为兼容oracle，对系统暂无实际影响
- 未设置client_identifier的会话，查到v$session上对应字段为NULL
- SET_IDENTIFIER 可以置NULL
- 任何用户都有权限执行这些过程


# 3. 详细测试设计

## 3.1 测试设计方法

对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略。

## 3.2 详细测试设计

1）client_identifier语法测试

|测试项|有效等价类|无效等价类|备注|
|---|---|---|---|
|参数个数|1|0、2|观察v$session上对应字段|
|client_identifier取值|null|不能隐式转换的非字符串类型|  
|
|  
|空字符串|子查询|  
|
|  
|空格|  
|  
|
|  
|中英文|  
|  
|
|  
|特殊字符|  
|  
|
|  
|函数表达式|  
|  
|
|  
|支持隐式转换的,非字符串类型|  
|  
|
|长度边界值|1~64|大于64|  
|


2）功能测试

|测试项|场景|预期|
|---|---|---|
|SET_IDENTIFIER    
    
|SET_IDENTIFIER成功：,新连接设置  合法client_identifier值|成功|
||SET_IDENTIFIER失败：,新连接设置  非法client_identifier值|报错|
||已设置client_identifier, 再次设置(等同于更新),1.再次设置成功；2.再次设置失败|1.执行成功，对应字段更新；,2.执行报错，对应字段不更新|
||中文字符集测试|  
|
|CLEAR_IDENTIFIER|CLEAR_IDENTIFIER成功：,DBMS_SESSION.CLEAR_IDENTIFIER|成功|
|多session|设置重名client_identifier|成功|
|复用清理|session重连，client_identifier被清理|client_identifier值为null|
|  
|session重连，重新设置client_identifier|成功|
|FREE_UNUSED_USER_MEMORY|调用DBMS_SESSION.FREE_UNUSED_USER_MEMORY|执行成功|
|分布式|执行高级包、v$session|高级包拦截、v$session有新增字段|


3）权限测试

- 任何用户都有权限执行


## 3.3 DFX测试

|DFX分类|是否涉及|
|:---|:---|
|CT |/|
|DFR|/|
|HA|/|
|KT kill测试|/|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|/|
|长稳|/|
|升级|/|
|扩缩容|/|
|备份恢复|/|


# 4. 测试用例

# 5. 测试框架设计

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现。

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


## Comments:

|  [](null)  ,2024/06/04会议纪要    
  1.client_identifier取值支持可隐式转换的非字符串类型    
  2.client_identifier中文取值超过64字节报错    
  3.已设置client_identifier, 再次设置，等同于更新    
  4.补充字符集测试,Posted by luoshuang at 六月 04, 2024 14:57|
|---|
