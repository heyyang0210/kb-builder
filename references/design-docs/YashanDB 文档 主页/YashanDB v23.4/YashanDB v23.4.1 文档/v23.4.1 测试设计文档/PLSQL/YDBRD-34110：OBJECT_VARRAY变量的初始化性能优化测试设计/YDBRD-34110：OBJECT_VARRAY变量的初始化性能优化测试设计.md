Created by 张欣 on 十二月 01, 2023



# 1. 概述

全局udt（object，varray）变量初始化性能优化得的测试设计。

  [https://pingcode.yasdb.com/pjm/items/670cf9ffe489dd0868f75187?](https://pingcode.yasdb.com/pjm/items/670cf9ffe489dd0868f75187?)  

#YDBRD-34110 OBJECT/VARRAY变量的初始化性能优化  *本文档描述*  

# 2. 需求分析

## 2.1 功能点分析

- 性能：主要是全局构造函数和object方法的使用场景 性能提升30%左右（基线master）。
- 功能：由历史功能用例看护。
- 并发：全局udt type并发ddl场景。


## 2.2 应用场景

1.默认构造方法

涉及三种udt类型：object、varray、nested table;  嵌套类型, 典型的 table of object

2.object自定义方法：

自定义构造方法；

全局方法

成员方法



**使用场景：**

1.声明单元udt变量初始化，赋初值； default值；

2.执行单元多次调用构造方法赋值；成员赋值； 赋值语句可以是带方法的表达式；

3.静态SQL:

DML语句，set value,filter 使用方法表达式；

select into/select bulk collect into 投影列，filter 使用方法表达式；

游标；

4.过程/方法 调用，实参传方法表达式；

5.动态SQL：

绑定变量传入方法表达式；

6.复杂的access 表达式

参考之前的access表达式功能加固  [(2432) 【YDBRD-32486】object方法中声明子过程问题分析 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/DANGWENQI/pages/6739653d728206efb92edefa)  







## 2.3 规格约束

*无*

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. **性能**


|场景大类|详细场景||
|---|---|---|
|1.声明单元udt变量初始化  ~~，赋初值；~~   default值；|~~声明多个变量 赋初值；~~,~~在嵌套块中多次声明变量，调用构造方法赋初值；~~,变量声明default值是构造方法，执行单元多次调用该变量；,|默认构造方法|
|2.执行单元多次调用构造方法赋值|整个变量调构造方法赋值；（object，varray, nested table）,成员是udt全局类型，调构造方法赋值；（二层，三层）,pkg中的变量调构造方法赋值；,%type,rowtype%继承的全局udt 变量赋值；,赋值语句可以是带方法的表达式；|默认构造方法|
|3.静态SQL|DML语句-insert,update,delete ，set value,filter 使用方法表达式；,select into/select bulk collect into 投影列，filter 使用方法表达式；,游标同上；|object方法还不支持在投影列，测默认构造方法|
|4.过程/方法 调用|实参传构造方法表达式；,过程中多次调用object 自定义构造方法/静态方法/成员方法；||
|5.动态SQL|DML,select into,动态游标,过程/方法 调用|方法表达式使用绑定变量传入|
|6.复杂的access 表达式|三层及以上的access 表达式，涉及全局udt方法的，挑几组测试性能||




     **2.并发**

历史udt用例有覆盖object/varray/nested table 类型使用过程中并发ddl。历史并发用例在  [standalone/storage_testcase/plsql/udt · master · CoD-X / Yastest Dfx · GitLab](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/standalone/storage_testcase/plsql/udt)  

本次针对典型场景再做部分加固覆盖：

1. plsql场景：二层嵌套的udt,大量调默认构造方法给外层变量或成员赋值；+ 内层/外层的type replace修改定义 结构改变/ 或 drop + create重建
1. plsql场景：过程/方法 调用object 自定义构造方法/静态方法/成员方法；+ replace 修改type head/type body 修改方法定义
1. 静态SQL:  select into 语句中用到默认构造方法  + type replace修改定义
1. 动态SQL：绑定变量传udt方法（select into、过程/方法调用） + type replace修改定义 / 或 drop + create重建




并发加固用例：

1、UDT：package(record)/varray/table/含成员方法object，不同表达式等值赋值，不同表达式展开access表达式赋值（调用方法），不同表达式展开access表达式赋值（展开到标量元素），access表达式在DML语句中的使用，type drop 重建DDL语句；

2、UDT：package(record)/table/含静态方法object/含构造方法object，不同表达式等值赋值，不同表达式展开access表达式赋值（调用方法），不同表达式展开access表达式赋值（展开到标量元素），access表达式在DML语句中的使用，type drop 重建DDL语句；

3、UDT：package(table)/含静态方法object/含成员方法object/table，不同表达式等值赋值，不同表达式展开access表达式赋值（调用方法），不同表达式展开access表达式赋值（展开到标量元素），access表达式在DML语句中的使用，type drop 重建DDL语句；

4、UDT：package(varray)/object/table/object，不同表达式展开access表达式赋值（调用方法）,type drop 重建DDL语句。



*  *     **3.梳理该特性是否涉DFX测试**  ，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|
|---|---|
|CT|是，见详细设计并发场景  
|
|KT|否，CT覆盖满足  
|
|长稳|否，性能优化无需新加用例  
|
|一致性|否，性能优化不涉及  
|
|三方测试工具    
  (sqltest，sqlancer)|否，性能优化不涉及  
|
|安全|否，性能优化不涉及  
|
|DFR|否，性能优化不涉及  
|
|HA|否，性能优化不涉及  
|
|压力|否，性能优化不涉及  
|
|性能|是，见详细设计性能场景  
|
|可维护性|是，性能和并发用例自动化看护  
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

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc4ZjExYTdiMzFmYWQyMWVhMGUyOWZkIiwicmVmX2lkIjoiNjc4ZjExYTdiMzFmYWQyMWVhMGUyYTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODQxLCJleHAiOjE3ODI1NDQyNDF9.VFe6h5wzbHBBRORZM3c3LG09VWfkkkiN7vEvFybjOMg)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc4ZjExYTdiMzFmYWQyMWVhMGUyOWZkIiwicmVmX2lkIjoiNjc4ZjExYTdiMzFmYWQyMWVhMGUyYTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODQxLCJleHAiOjE3ODI1NDQyNDF9.VFe6h5wzbHBBRORZM3c3LG09VWfkkkiN7vEvFybjOMg)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc4ZjExYTdiMzFmYWQyMWVhMGUyOWZlIiwicmVmX2lkIjoiNjc4ZjExYTdiMzFmYWQyMWVhMGUyYTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODQxLCJleHAiOjE3ODI1NDQyNDF9.b0mT6RRDqMq6EM8wpCfytitVxQWxSj_tzV6FlQAO4h8)

 (application/msword)    
