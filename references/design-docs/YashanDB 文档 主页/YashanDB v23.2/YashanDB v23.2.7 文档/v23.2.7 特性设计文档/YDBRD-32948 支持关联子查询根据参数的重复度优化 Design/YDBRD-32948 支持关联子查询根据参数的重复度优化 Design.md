Created by 钟金健 on 十月 15, 2024

*详细设计-YDBRD-32948 : 支持关联子查询根据参数的重复度优化 Design*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/66e2876c4283cf23d4f53214](https://pingcode.yasdb.com/ship/ideas/66e2876c4283cf23d4f53214)    *?*    
  *#YASHAN-3323 支持关联子查询根据参数的重复度优化*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66ea83d856ee364dc20752f0](https://pingcode.yasdb.com/pjm/items/66ea83d856ee364dc20752f0)    *?*    
  *#YDBRD-32948 支持关联子查询根据参数的重复度优化*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#1-%E6%80%BB%E8%BF%B0)  

该需求是为了优化关联子查询的执行，减少关联子查询的一部分无效重复执行。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

  [[SAISSUE-563] 【博时基金】ss_bal_fund_before_deduction_view查询在Yashan耗时1506秒，Oracle串行执行使用180秒，并发执行仅用时44秒 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/SAISSUE-563)  

博时基金

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

模型简化：

表student

|id|classId|name|
|---|---|---|
|1|1|小明|
|2|1|小东|
|3|3|小红|
|4|3|小青|
|5|2|小华|


表class

|classId|name|  
|
|---|---|---|
|1|高一1班|  
|
|1|高一奥数班|与高一1班是同一个班级的不同名字|
|2|高一2班|  
|
|3|高二1班|  
|


  用例sql

```
drop table student;
drop table class;
create table student(id int, classId int, name varchar2(100));
create table class(classid int, name varchar2(100));
-- 高一1班和高一奥数班是同一个班级的不同名字
insert into class values(1,'高一1班');
insert into class values(1,'高一奥数班');
insert into class values(2,'高一2班');
insert into class values(3,'高二1班');
insert into student values(1,1,'小明');
insert into student values(2,1,'小东');
insert into student values(3,3,'小红');
insert into student values(4,3,'小青');
insert into student values(5,2,'小华');
commit;

--获取人数大于等于2个人的所有班级名字
select c.classId , c.name from class c where (select count(s.id) from student s where c.classid=s.classId) >= 2;
```

性能指标（待确定）

--获取人数大于等于2个人的所有班级名字

**select c.classId , **    [c.name](http://c.name)    ** **

**from class **  **c**  ** **

**where (  **  **select count(**    [s.id](http://s.id)    **) **

**               **  **from student s **

**                **  **where f(**  **c.classid)**  **=s.classId**

**             **  **)**  ** >= 2;**

这个语句中的子查询是一个关联子查询，子查询引用了父查询的class表的c.classId。对于父查询中的class表中的每一条数据，都会执行一次子查询得到一个结果。且对于每一个传入classId的值，都会得到一个具体的结果集。

- 记结果集为result，子查询的运算为f，则result、f、classId的关系可以简单记为 result = f(classId)
- 进一步，如果关联子查询中，子查询引用父查询的表达式可以有多个，分别记为ref1、ref2、ref3...，则result = f (ref1,ref2, ref3, ...)
- 非确定外部引用、  非确定性子查询（待补充）


对于上诉提到的场景，class表存在两行数据有相同的classId，根据result=f (classId)，子查询会查询出两个相同的结果集。  同一个结果集，却执行了两次，这是一种性能浪费  。

这个需求就需要减少这种场景下的关联子查询重复执行。

  


|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|性能|性能场景1|  
|是/否|是/否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|关联子查询|  
|是|  
|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

使用HDT，会占用VM空间

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#4-%E7%89%B9%E6%80%A7)  

###   [4.1 特性功能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    ：使用    [HDT](https://conf.yasdb.com/display/YAS/HDT)    缓存映射关系

对于上述提到的result = f (ref1, ref2, ref3, ...)

关联子查询执行流程图

![](https://pingcode.yasdb.com/atlas/files/public/67396e15a1ad9a3311dc9511/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFCQUFBQUFBQUFCQUFBQUlBQUFBQUVBSUFBQUFBQUFBUUFBQUFBQUFBSUFBUUFBZ0FBQUFBUUFBQUFBQUFBQUFCQUFBQUFBQUFBZ0FBQUJBQUFBQUFBQUNBQUFBQUFBQUFBQUFFQUFBQUFBQUFBUUFBQkFBQUFBQUFBQUFBQUFBQUFBSkFBQVFBQUFBQWdBQUFBQUFBQUFBS0FBQUNBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTQwOTYsImV4cCI6MTc4MjMyNDg5Nn0.Z_MOE88VLP_YT_y_KHzkHbFdYEzi8Rdynb_kzkuoJvo)



关键点1：是否需要映射缓存加速

- 条件1：必须是关联子查询


- 条件2：子查询外部引用表达式的值distinct比例应该少于一个阈值：暂定比例0.5，或者增加一个隐藏参数进行控制该比例（该场景性能优化的前提：重复执行子查询所消耗的时间比HDT缓存映射的花销要多）
- 条件3：HDT空间花销应该在某个可控范围内（需要数据量信息，需要一行待物化的占用字节信息）


  


关键点2：HDT生命周期

- 创建：第一次触发该子查询执行的时候，进行物化区的初始化
- 使用：如果子查询使用了HDT进行加速，每次执行子查询的时候会进行HDT访问
- 销毁：语句结束以后统一回收


  


关键点3：结果集的组织方式、大小

**结果集的组织方式**  ：分为key与value，key指向value （）

**消耗VM空间估计公式**  ：

对于每一个不同的(ref1, ref2, ...)，行数n，每一行所有列类型占用字节数与头部控制信息加起来rowSize，size = n * rowSize

有m个(ref1, ref2, ...)，则totoleSize = size1 +size2+size3+... + sizem

  


###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    ：关联子查询出现的位置：

#### 1）过滤条件in and not in：

**场景1**  ：c1 in (select data from xxx where xx ref1)  → exists (select 1 from xxx where xx ref1=c1)

**场景2**  ：(c1, c2, c3, ...) in (select data1, data2, data3, ... from xxx where xxx)  （HDT物化区需要物化多列）

代码：doExecFilterInSelect和doExecFilterNotInSelect，execFilterMultiValuesInSelect，execFilterMultiValuesNotInSelect

**结果集特点**  ：result = f (ref1, ref2, ...)，其中的result多行多列，key: (ref1, ref2, ...) → value : (data1, data2,...)。每一列的类型根据子查询投影列确定，对应子查询查出的多行多列。

filter in改写成filter exists。

如c1 in (select data from xxx where xxx ref1)，key: c1  → value : data

可以改写成 key: (c1, ref1) → value: boolean

如果filter in右边是静态子查询，是否需要做优化（待确定）

#### 2）过滤条件exists and not exists：

exist (select xx ref1)   key : ref1, value:boolean

代码：doExecFilterExists

**结果集特点**  ：result = f (ref1, ref2, ...)，其中的result只有一行一列。列的类型是boolean，表示子查询的结果是否为空。result的key : (ref1, ref2, ...) → value : (boolean)

  


#### 3）表达式运算的一部分：

代码：doExecSubQueryDirectly

**结果集特点**  ：result = f (ref1, ref2, ...)，其中的result只有一行一列。列的类型由子查询投影列确定，表示子查询出来的结果。result的key : (ref1, ref2, ...) → value : proj，其中proj是子查询的投影列

  


###   [4.3 特性功能点3](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    ：关联子查询复杂场景

#### 1）兄弟关联子查询

select t1.c1 from   t1   where ( select count(t2.id) from t2.data=  t1.data   ) >= 2 and exists ( select 1 from t3 where t3.id =   t1.id  );

其中的两个子查询就是兄弟子查询

兄弟子查询互不影响：

1. 两个子查询是否使用HDT缓存加速由自身情况确定，互不影响
1. 假如两个子查询都选用了HDT进行加速，则两个HDT物化区是独立的，互不影响


子查询1结果集映射关系，hash(t1.data) → result1 =  f1 (t1.data)，其中f1为子查询1的具体运算

子查询2结果集映射关系，hash(t1.data) → result2 =  f2 (t1.data)，其中f2为子查询2的具体运算

  


![](https://pingcode.yasdb.com/atlas/files/public/67396e158970c2af4f52169e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFCQUFBQUFBQUFCQUFBQUlBQUFBQUVBSUFBQUFBQUFBUUFBQUFBQUFBSUFBUUFBZ0FBQUFBUUFBQUFBQUFBQUFCQUFBQUFBQUFBZ0FBQUJBQUFBQUFBQUNBQUFBQUFBQUFBQUFFQUFBQUFBQUFBUUFBQkFBQUFBQUFBQUFBQUFBQUFBSkFBQVFBQUFBQWdBQUFBQUFBQUFBS0FBQUNBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTQwOTYsImV4cCI6MTc4MjMyNDg5Nn0.Z_MOE88VLP_YT_y_KHzkHbFdYEzi8Rdynb_kzkuoJvo)

  


#### 2）多层关联子查询

场景一：select t1.c1 from t1 where (   select count(t2.id)  from  t2.data = t1.data where exists ( select 1 from t3 where t3.id = t1.id )  ) >= 2;

父查询结果集映射关系：hash(t1.data, t1.id) → result1 = f1(t1.data, t1.id)，其中f1为父查询的具体运算

子查询结果集映射关系：hash(t1.id) → result2 = f2(t1.id)，其中f2为子查询的具体运算

![](https://pingcode.yasdb.com/atlas/files/public/67396e158970c2af4f52169f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFCQUFBQUFBQUFCQUFBQUlBQUFBQUVBSUFBQUFBQUFBUUFBQUFBQUFBSUFBUUFBZ0FBQUFBUUFBQUFBQUFBQUFCQUFBQUFBQUFBZ0FBQUJBQUFBQUFBQUNBQUFBQUFBQUFBQUFFQUFBQUFBQUFBUUFBQkFBQUFBQUFBQUFBQUFBQUFBSkFBQVFBQUFBQWdBQUFBQUFBQUFBS0FBQUNBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTQwOTYsImV4cCI6MTc4MjMyNDg5Nn0.Z_MOE88VLP_YT_y_KHzkHbFdYEzi8Rdynb_kzkuoJvo)

并行不支持

  


场景二：select t1.c1 from t1 where (   select count(    [t2.id](http://t2.id)    )  from  t2.data = t1.data where exists ( select 1 from t3 where     [t3.id](http://t3.id)     =     [t2.id](http://t1.id)     )  ) >= 2;

父查询结果集映射关系：hash(t1.data) → result1 = f1(t1.data)，其中f1为父查询的具体运算

子查询结果集映射关系：hash(    [t2.id](http://t1.id)    ) → result2 = f2(    [t2.id](http://t1.id)    )，其中f2为子查询的具体运算

![](https://pingcode.yasdb.com/atlas/files/public/67396e158970c2af4f5216a0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFCQUFBQUFBQUFCQUFBQUlBQUFBQUVBSUFBQUFBQUFBUUFBQUFBQUFBSUFBUUFBZ0FBQUFBUUFBQUFBQUFBQUFCQUFBQUFBQUFBZ0FBQUJBQUFBQUFBQUNBQUFBQUFBQUFBQUFFQUFBQUFBQUFBUUFBQkFBQUFBQUFBQUFBQUFBQUFBSkFBQVFBQUFBQWdBQUFBQUFBQUFBS0FBQUNBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTQwOTYsImV4cCI6MTc4MjMyNDg5Nn0.Z_MOE88VLP_YT_y_KHzkHbFdYEzi8Rdynb_kzkuoJvo)

  


场景三：select t1.c1 from t1 where (   select count(    [t2.id](http://t2.id)    )  from  t2.data = t1.data where exists ( select 1 from t3 where     [t3.id](http://t3.id)     >     [t1.id](http://t1.id)     and     [t3.id](http://t3.id)     =     [t2.id](http://t1.id)    )  ) >= 2;

父查询结果集映射关系：hash(t1.data, t1.id) → result1 = f1(t1.data, t1.id)，其中f1为父查询的具体运算

子查询结果集映射关系：hash(    [t1.id](http://t1.id)    ,     [t2.id](http://t1.id)    ) → result2 = f2(    [t1.id](http://t1.id)    ,     [t2.id](http://t1.id)    )，其中f2为子查询的具体运算

![](https://pingcode.yasdb.com/atlas/files/public/67396e158970c2af4f5216a1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFCQUFBQUFBQUFCQUFBQUlBQUFBQUVBSUFBQUFBQUFBUUFBQUFBQUFBSUFBUUFBZ0FBQUFBUUFBQUFBQUFBQUFCQUFBQUFBQUFBZ0FBQUJBQUFBQUFBQUNBQUFBQUFBQUFBQUFFQUFBQUFBQUFBUUFBQkFBQUFBQUFBQUFBQUFBQUFBSkFBQVFBQUFBQWdBQUFBQUFBQUFBS0FBQUNBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTQwOTYsImV4cCI6MTc4MjMyNDg5Nn0.Z_MOE88VLP_YT_y_KHzkHbFdYEzi8Rdynb_kzkuoJvo)

观测指标：结果是否正确、VM使用

  


  


###   [4.4 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-9-25_17-49-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTRhMWFkOWEzMzExZGM5NTBjIiwicmVmX2lkIjoiNjczOTZlMTQ3MjgyMDZlZmI5MmYyNTkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzE0MDk2LCJleHAiOjE3ODI0MDA0OTZ9.8TxGgIp8Yev-vXbJeo4Xw-pg2RS_G1aDjrFUb6ZvO6s)

 (image/png)    


[image2024-9-25_17-35-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTQ4OTcwYzJhZjRmNTIxNjk5IiwicmVmX2lkIjoiNjczOTZlMTQ3MjgyMDZlZmI5MmYyNTkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzE0MDk2LCJleHAiOjE3ODI0MDA0OTZ9.sC59bNMkwMNP_3ktCTSJLkPKRv1XiGgAxZnLuI_gZps)

 (image/png)    


[image2024-9-25_14-59-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTQ4OTcwYzJhZjRmNTIxNjlhIiwicmVmX2lkIjoiNjczOTZlMTQ3MjgyMDZlZmI5MmYyNTkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzE0MDk2LCJleHAiOjE3ODI0MDA0OTZ9.QNWkuTUjAmkL6mRHK3LfblYG_fKqqeMHrMDah3JfE7w)

 (image/png)    


[image2024-9-25_14-55-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTRhMWFkOWEzMzExZGM5NTBkIiwicmVmX2lkIjoiNjczOTZlMTQ3MjgyMDZlZmI5MmYyNTkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzE0MDk2LCJleHAiOjE3ODI0MDA0OTZ9.NnGHC6ASKcahmKKvQbzGNlYQeoqvlH4GUO6RjIG4G5w)

 (image/png)    


[image2024-9-25_14-28-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTVhMWFkOWEzMzExZGM5NTBlIiwicmVmX2lkIjoiNjczOTZlMTQ3MjgyMDZlZmI5MmYyNTkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzE0MDk2LCJleHAiOjE3ODI0MDA0OTZ9.j69prmYo91tiOLqCMcv0G1hqc9mnTcXJNGfDfgUF1Ic)

 (image/png)    


[image2024-9-25_14-23-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTU4OTcwYzJhZjRmNTIxNjliIiwicmVmX2lkIjoiNjczOTZlMTQ3MjgyMDZlZmI5MmYyNTkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzE0MDk2LCJleHAiOjE3ODI0MDA0OTZ9.03xd2dSta5Dj91gNxPLCkxlQa_S7otD1DJh1aq7nic4)

 (image/png)    


[image2024-9-25_11-37-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTVhMWFkOWEzMzExZGM5NTEwIiwicmVmX2lkIjoiNjczOTZlMTQ3MjgyMDZlZmI5MmYyNTkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzE0MDk2LCJleHAiOjE3ODI0MDA0OTZ9.lJXdKJ7ahDRIMD6HkDbCdIYL5jDg9aSezO1Z1_xAXKg)

 (image/png)    


[image2024-9-24_17-0-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTU4OTcwYzJhZjRmNTIxNjlkIiwicmVmX2lkIjoiNjczOTZlMTQ3MjgyMDZlZmI5MmYyNTkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzE0MDk2LCJleHAiOjE3ODI0MDA0OTZ9.sOPEwZlRgqd0fCZ-yfY6VM6XAIhc_GP8Gp40V1VsJQ8)

 (image/png)    
