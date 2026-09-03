# 

注：特性调研文档仅用于提供方案的参考，  **不等同于关键特性的备选概念**  ，后者需要落在概要设计或详细设计文档。

*---------------以下为正文开始分隔线-----------------*

*# 特性调研-YDBRD-41553: 支持AT TIME ZONE Research（支持AT TIME ZONE 特性调研） *

*IR链接：YDBRD-889*

*SR链接：YDBRD-41553*

##   [1. 总述](#1-总述)  

at time zone ***是一种语法，用来将表达式转成timestamp with time zone类型；后面可以接 sessionTimezone/dbtimezone关键字或者是字符串类型的常量或非常量；字符串常量可以是tzh:tzm格式，也可以是tzr/tzd。



###   [1.1 需求来源](#11-需求来源)  

外场：中远海运

           深圳JIAOJ



###   [1.2 调研文档](#12-调研文档)  

oracle暂未找到相关文档介绍语法

SQL server:  [https://learn.microsoft.com/en-us/sql/t-sql/queries/at-time-zone-transact-sql?view=sql-server-ver16](https://learn.microsoft.com/en-us/sql/t-sql/queries/at-time-zone-transact-sql?view=sql-server-ver16)  



###   [1.3 需求分析](#13-需求分析)  

#### 1.3.1 语法分析

   该需求的完整语法为：expr at time zone format .......，表达式整体返回timestamp tz类型， 其中可支持的expr与format如下：

||支持范围|
|---|---|
|expr|·1、可以为常量NULL，返回NULL，类型还是tz,2、支持timestamp， timestamp tz， timestamp ltz与time类型,3、仅适用于最靠近at的expr，如 a+b at time zone(其中a为timestamp类型，b为dsInterval类型）会报错；但是(a+b) at time zone会执行成功|
|format|1、可以为常量NULL，返回NULL,2、支持字符串类型以及sessionTimezone与dbtimezone关键字，不支持隐式转换,3、字符串类型可以为常量以及非常量,4、字符串类型格式可以是TZH:TZM, TZR, TZD格式,如：,select (a+b) at time zone '12:00' from ttl;,select (a+b) at time zone 'asia/Shanghai' from ttl;,select (a+b) at time zone 'US/Pacific' from ttl;,5、tzh:tzm的范围为 -13.59~14.59; 与session 设置的范围不一样，session的为 -15:59 ~ 15:00|




#### 1.3.2 expr数据类型表现

|expr数据类型|表现|
|---|---|
|timestamp/timestamp with local time zone|会用session对应的时区作为expr的基本时区，然后与format时区做一个偏移来显示最终结果|
|timestamp with time zone        |以数据类型本身的时区作为基本时区，然后与format时区做一个偏移来显示最终结果|




#### 1.3.3 format表现

|format场景    |表现|
|---|---|
|输入dbtimezone、sessiontimezone    |根据设置的时区作为最终时区来返回结果|
|输入TZH:TZM / TZR / TZD    |均可识别，根据输入算出时区值，然后来计算结果；最终的显示受timestamp_tz_format影响|




#### 1.3.4 实现分析

    oracle在实现该语法时，因为format可以是column等非常量，所以oracle把该语法识别后变成了内部函数来做：explain plan for select a from tm2 where b at time zone '12:00' > timestamp'2025-1-1 1:2:3.123';



![image.png](https://pingcode.yasdb.com/atlas/files/public/6821f45daab75fc0aeb2d20f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0MDMsImV4cCI6MTc4MjQ2NzIwM30.RxjAEKnTkwP0PCh6R0koyAf579gF0xTJGPgOI-NdcOo)



##   [3. 规格与约束](#3-规格与约束)  

规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。