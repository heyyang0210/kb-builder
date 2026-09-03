Created by 马士杰, last modified on 八月 27, 2024

详细设计-YDBRD-26236

SR链接：    [https://pingcode.yasdb.com/pjm/items/661900e1fd997db58ad871df](https://pingcode.yasdb.com/pjm/items/661900e1fd997db58ad871df)    ?    
  #YDBRD-26236 支持设置与YashanDB兼容的SQL_MODE

  


# 1.总述

  


支持如下的特定SQL_MODE模式： ONLY_FULL_GROUP_BY 

STRICT_TRANS_TABLES 

NO_ZERO_IN_DATE

 NO_ZERO_DATE 

ERROR_FOR_DIVISION_BY_ZERO 

NO_AUTO_CREATE_USER 

NO_ENGINE_SUBSTITUTION

 HIGH_NOT_PRECEDENCE 

NO_UNSIGNED_SUBTRACTION 

PAD_CHAR_TO_FULL_LENGTH

 STRICT_ALL_TABLES

  


## 1.1 需求来源

MySQL兼容性支持

支持形态：单机

  


## 1.2 调研文档

  


调研文档见    [SQL_MODE(2024.1.3)](https://conf.yasdb.com/pages/viewpage.action?pageId=141567965)  

  [【Mysql兼容】支持date识别和插入0000-00-00格式调研文档 - 马士杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150626651)  

  [【MySQL兼容】sqlmode支持REAL_AS_FLOAT、PIPES_AS_CONCAT、ANSI_QUOTES - 马士杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156112179)  

  


## 1.3 需求分析

  


之前的需求中实现了部分sqlmode的功能（REAL_AS_FLOAT/PIPES_AS_CONCAT/ANSI_QUOTES），部分sqlmode按照yashan内部param的方式实现（NO_ZERO_DATE NO_ZERO_IN_DATE）

本需求要求实现特定的SQL_MODE模式，列出的SQL_MODE在设置所控制的行为，是YashanDB的默认行为一致。因此，无论是否设置，这些SQL_MODE都处于生效状态。

其中NO_ZERO_DATE NO_ZERO_IN_DATE之前在yashan模式下实现，本需求修改为只在MySQL兼容模式下生效。

  


# 2.接口

本需求没有新增接口

  


# 3.规格与约束

  


本需求的规格与约束和sqlmode保持一致，参考    [【MySQL兼容】SQL_MODE支持REAL_AS_FLOAT/PIPES_AS_CONCAT/ANSI_QUOTES设计文档 - 马士杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156112199)  

  


STRICT_TRANS_TABLES 默认值为true

NO_ZERO_IN_DATE 默认值为true

 NO_ZERO_DATE 默认值为true

ERROR_FOR_DIVISION_BY_ZERO 默认值为true

NO_AUTO_CREATE_USER 默认值为true 

NO_ENGINE_SUBSTITUTION 默认值为true

 HIGH_NOT_PRECEDENCE 默认值为false

NO_UNSIGNED_SUBTRACTION 默认值为true 

PAD_CHAR_TO_FULL_LENGTH 默认值为true

 STRICT_ALL_TABLES 默认值为true

  


# 4.特性

## 4.1特性设计

增加上述sqlmode对应的SQL_MODE_DECL和gMyDefaultSqlModes

在myExecSetSqlMode中增加修改stmt上NO_ZERO_IN_DATE和NO_ZERO_DATE

在修改sqlmode时给sessionParam上的NO_ZERO_IN_DATE和NO_ZERO_DATE赋值，在切换回yashan模式后，NO_ZERO_DATE和NO_ZERO_IN_DATE失效（即置为true）

  


# 5. Testcases（自测用例）

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。 自测关注点： 1. 覆盖全面 2. 避免重复测试 3. 测试用例的可维护性 自测用例设计方法： 1. 边界值 2. 等价类 3. 正交

  


# 6.资料设计章节 

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

  


# 7.未来规划

  


  
