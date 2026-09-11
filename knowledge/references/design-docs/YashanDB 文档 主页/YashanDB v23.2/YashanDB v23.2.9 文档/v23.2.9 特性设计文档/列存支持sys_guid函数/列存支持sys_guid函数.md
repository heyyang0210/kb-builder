Created by 许中立, last modified on 十一月 14, 2024

SR:    [https://pingcode.yasdb.com/ship/ideas/672b175752495bd785c790ac](https://pingcode.yasdb.com/ship/ideas/672b175752495bd785c790ac)    ?    
  #YASHAN-3445 列存支持sys_guid函数

##   [1. 总述](#1-总述)  

列存支持sys_guid函数，生成不重复的数据的一个函数，sys_guid()一共32位，生成的依据主要是时间和机器码，具有唯一性。

###   [1.1 需求来源](#11-需求来源)  

1.在对象在不同机器的不同数据库里生成以及需要在后来合并到一起的情况下，使用SYS_GUID函数可以防止主键冲突。

###   [1.2 调研文档](#12-调研文档)  

|友商名|功能体现|实现原理|函数|
|---|---|---|---|
|Oracle|返回32位字符串（0-9，A-F）组成的标识符，可能存在乱码，可通过rawtohex()转换成可打印字符。|主机标符+执行函数的进程或显出标识符+进程或线程的字节序列|sys_guid()|
|OceanBase|返回十六进制表示形式的长度为 32 个字符的字符串。||sys_guid()|


###   [1.3 需求分析](#13-需求分析)  

客户需要通过sys_guid生成唯一值作为主键，且对性能没有要求。人力预估1人/周，采用通用表达式实现。



###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|sys_guid()|返回十六进制表示形式的长度为 32 个字符的字符串。|该函数生成并返回由 16 个字节组成的全局唯一标识符，即生成一个全局唯一序列号。|是|


##   [3. 规格与约束](#3-规格与约束)  

1. 支持分布式，单机，共享集群
1. 保证库内，集群内唯一。


##   [4. 特性](#4-特性)  

1. 使用通用表达式实现。
1. 目前行存的sys_guid返回值为随机值，批量使用该函数时，可能存在重复值。因此行存sys_guid实现重构，与列存一样，采用endpint(2字节) + 时间戳（8字节） + ankhandler id(2字节) +  递增序列（4字节），返回十六进制表示形式的长度为 32 个字符的字符串。


###   [4.1 列存支持sys_guid()](#41-特性设计)  

1. sys_guid走通用表达式，在FuncId中增加sys_guid类型


```
pub enum FuncId {
  xxxx,
  SysGuid = EnBuiltinFuncId_BIF_SYS_GUID as u32,
  xxxx,
}
```

###   [4.2 重构sys_guid()行存实现](#42-特性功能点2)  

1. 获得endpoint(2字节)（单机，采用随机值俩个字符，集群无endpoint，用id，u8+随机值）（确认共享集群id是否区分主备？）
1. ankHandler首次执行时再初始化session的时间戳，通过此获得时间戳（8字节）
1. 获得ankHandlerAttr->id（2字节）
1. ankHandler上新增自增序列（4字节）


####   [4.22 流程图](#42-特性功能点2)  

![sys_guid.jpg](https://pingcode.yasdb.com/atlas/files/public/673fee22a1ad9a3311de35d0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ0NzQsImV4cCI6MTc4MjMzNTI3NH0.J1FLCJ1W6D_aK3V4DLqHvC4DUfoXIK83j6lfi_jO4V0)

####   [4.23 异常失败处理](#42-特性功能点2)  

1. 自增序列无需回滚


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 单机环境，列存使用sys_guid()。
1. 分布式环境，列存使用sys_guid()。
1. 共享集群环境，列存使用sys_guid()。


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。