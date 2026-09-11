Created by 张璐恒, last modified on 十二月 13, 2023

  [YDBRD-22007](https://jira.yasdb.com/browse/YDBRD-22007?src=confmacro)    -  分布式支持rollup，cube，grouping sets  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=133585309#1-overview%E6%A6%82%E8%BF%B0)  

本需求的主要作用为满足TPC-DS中rollup需求，在分布式下增加对grouping sets/rollup/cube的支持

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=133585309#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

###   [2.1 语法介绍](https://conf.yasdb.com/pages/viewpage.action?pageId=133585309#22-%E6%96%B0%E5%A2%9E%E8%AF%B4%E6%98%8E)  

group_by

![](https://pingcode.yasdb.com/atlas/files/public/67396c498970c2af4f520abd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0RBQUVBQUFBQkFBQkFBQVlCQkFBQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBRUJBQUFBSkJBQUNBQUFBQUVBQUFBQUFBQUFBQ0FBQUFDQUFBSUFBQWdBQUFBQUFoQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUVBQWdBQUFBQkFBQUFBQUFBQUFFQUlBQUdBQUFBRUFCQUFBQ0FBQUJRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNTcsImV4cCI6MTc4MjMxMDk1N30._zOQ9Jsjc1YYVn3PCv83sTUHWiQqozyELicFAPkuFwc)

grouping_sets_clause

![](https://pingcode.yasdb.com/atlas/files/public/67396c498970c2af4f520abe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0RBQUVBQUFBQkFBQkFBQVlCQkFBQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBRUJBQUFBSkJBQUNBQUFBQUVBQUFBQUFBQUFBQ0FBQUFDQUFBSUFBQWdBQUFBQUFoQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUVBQWdBQUFBQkFBQUFBQUFBQUFFQUlBQUdBQUFBRUFCQUFBQ0FBQUJRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNTcsImV4cCI6MTc4MjMxMDk1N30._zOQ9Jsjc1YYVn3PCv83sTUHWiQqozyELicFAPkuFwc)

  


rollup_cube_clause

![](https://pingcode.yasdb.com/atlas/files/public/67396c49a1ad9a3311dc892d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0RBQUVBQUFBQkFBQkFBQVlCQkFBQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBRUJBQUFBSkJBQUNBQUFBQUVBQUFBQUFBQUFBQ0FBQUFDQUFBSUFBQWdBQUFBQUFoQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUVBQWdBQUFBQkFBQUFBQUFBQUFFQUlBQUdBQUFBRUFCQUFBQ0FBQUJRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNTcsImV4cCI6MTc4MjMxMDk1N30._zOQ9Jsjc1YYVn3PCv83sTUHWiQqozyELicFAPkuFwc)

###   [2.2 功能说明](https://conf.yasdb.com/pages/viewpage.action?pageId=133585309#21-%E7%8E%B0%E7%8A%B6%E8%AF%B4%E6%98%8E)  

#### 2.2.1 grouping sets

grouping sets是group by子句更进一步的扩展，能够定义多个数据分组。

grouping sets 等价于 多个（group by 分组中的单项） union all 起来。

例如 按照grouping sets(a,b,c)分组 的统计列为 (a)、(b)、(c)

```
select xxx from t2 group by grouping sets (a,b) 
= 
select xxx from t2 group by a uinion all 
select xxx from t2 group by b;
```

  


![](https://pingcode.yasdb.com/atlas/files/public/67396c49a1ad9a3311dc892f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0RBQUVBQUFBQkFBQkFBQVlCQkFBQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBRUJBQUFBSkJBQUNBQUFBQUVBQUFBQUFBQUFBQ0FBQUFDQUFBSUFBQWdBQUFBQUFoQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUVBQWdBQUFBQkFBQUFBQUFBQUFFQUlBQUdBQUFBRUFCQUFBQ0FBQUJRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNTcsImV4cCI6MTc4MjMxMDk1N30._zOQ9Jsjc1YYVn3PCv83sTUHWiQqozyELicFAPkuFwc)

限制：grouping sets括号中至少指定一列，当仅指定一列时，执行计划和执行结果等同于不加grouping sets。

例如

```
select count(*) from t1 group by grouping sets(c1);
=
select count(*) from t1 group by c1;
```

此外，grouping_sets_clause括号中可以放rollup或者cube。

例如   按照grouping sets(rollup(a,b),c)分组 的统计列为 rollup(a,b)、(c) => 这里rollup(a,b) 的效果可以按照rollup的规则继续展开。

![](https://pingcode.yasdb.com/atlas/files/public/67396c498970c2af4f520ac0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0RBQUVBQUFBQkFBQkFBQVlCQkFBQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBRUJBQUFBSkJBQUNBQUFBQUVBQUFBQUFBQUFBQ0FBQUFDQUFBSUFBQWdBQUFBQUFoQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUVBQWdBQUFBQkFBQUFBQUFBQUFFQUlBQUdBQUFBRUFCQUFBQ0FBQUJRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNTcsImV4cCI6MTc4MjMxMDk1N30._zOQ9Jsjc1YYVn3PCv83sTUHWiQqozyELicFAPkuFwc)

#### 2.2.2   rollup

rollup跟grouping sets类似

按照rollup(a,b,c)分组 的统计列为 (a,b,c)、(a,b)、(a)、()

```
select xxx from t2 group by rollup (a,b)  
=
select xxx from t2 group by a union all 
select xxx from t2 group by a,b union all 
select xxx from t2 group by null
```

![](https://pingcode.yasdb.com/atlas/files/public/67396c498970c2af4f520ac2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0RBQUVBQUFBQkFBQkFBQVlCQkFBQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBRUJBQUFBSkJBQUNBQUFBQUVBQUFBQUFBQUFBQ0FBQUFDQUFBSUFBQWdBQUFBQUFoQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUVBQWdBQUFBQkFBQUFBQUFBQUFFQUlBQUdBQUFBRUFCQUFBQ0FBQUJRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNTcsImV4cCI6MTc4MjMxMDk1N30._zOQ9Jsjc1YYVn3PCv83sTUHWiQqozyELicFAPkuFwc)

限制：rollup括号中至少需要指定一列，当仅指定一列时，执行结果会比不带rollup多一行汇总信息（group by()）。

![](https://pingcode.yasdb.com/atlas/files/public/67396c49a1ad9a3311dc8932/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0RBQUVBQUFBQkFBQkFBQVlCQkFBQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBRUJBQUFBSkJBQUNBQUFBQUVBQUFBQUFBQUFBQ0FBQUFDQUFBSUFBQWdBQUFBQUFoQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUVBQWdBQUFBQkFBQUFBQUFBQUFFQUlBQUdBQUFBRUFCQUFBQ0FBQUJRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNTcsImV4cCI6MTc4MjMxMDk1N30._zOQ9Jsjc1YYVn3PCv83sTUHWiQqozyELicFAPkuFwc)

#### 2.2.3 cube

cube和rollup类似

按照cube(a,b,c)分组 的统计列为(a,b,c)、(a,b)、(a,c)、(b,c)、(a)、(b)、(c)、()

```
select xxx from t2 group by cube(a,b)  
=
select xxx from t2 group by a union all 
select xxx from t2 group by b union all 
select xxx from t2 group by a,b union all 
select xxx from t2 group by null
```

![](https://pingcode.yasdb.com/atlas/files/public/67396c49a1ad9a3311dc8933/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0RBQUVBQUFBQkFBQkFBQVlCQkFBQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBRUJBQUFBSkJBQUNBQUFBQUVBQUFBQUFBQUFBQ0FBQUFDQUFBSUFBQWdBQUFBQUFoQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUVBQWdBQUFBQkFBQUFBQUFBQUFFQUlBQUdBQUFBRUFCQUFBQ0FBQUJRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxNTcsImV4cCI6MTc4MjMxMDk1N30._zOQ9Jsjc1YYVn3PCv83sTUHWiQqozyELicFAPkuFwc)

限制：cube括号中至少需要指定一列，当仅指定一列时，执行结果会比不带cube多一行汇总信息（group by()）。

###   [2.3 概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133585309#221-distinct-dn%E6%89%A7%E8%A1%8C)  

rollup、cube做grouping sets的方式和单机保持一致：  通过优化器将Rollup和Cube拆分为union all Grouping sets操作的方式来实现。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=133585309#3-interfaces%E6%8E%A5%E5%8F%A3)  

transLogiAdvGroup2GroupSets，transAdvGroup2GroupingSets

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=133585309#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

grouping sets/rollup/cube都至少要指定一列。

而指定列的上限取决于roll/cube转换成grouping sets后所有的列数有没有超过objarray的最大限制，超过则报错GROUPING SETS/ROLLUP/CUBE is out of range。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=133585309#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

rollup、cube做grouping sets的方式和单机保持一致：  通过优化器将Rollup和Cube拆分为Grouping sets操作的方式来实现。

```
rollup(a,b)
转换为
grouping sets(a,(a,b),())

cube(a,b)
转换为
grouping sets(a,(a,b),b,())
```

  


 在cn上优化阶段将rollbup/cube括号中的项拆出来再根据rollup，cube分组规则进行组合，详见单机设计文档：    [Grouping sets/Rollup/Cube设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109577167)    。

##   [6.自测](https://conf.yasdb.com/pages/viewpage.action?pageId=133585309#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

结果对比单机结果，和单机保持一致

- 三种语法入参为空 
- 入参带null。
- grouping set中带cube和rollup。
- 不同入参个数
- 子集中不同参数个数
- 改变子集顺序


## Attachments:

[image2023-11-2_19-9-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDhhMWFkOWEzMzExZGM4OTFjIiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.6xm-oSJwdUL57HfGjfDNwwOjvXB-sgxtcDpkhD0SDJM)

 (image/png)    


[image2023-11-3_10-53-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDg4OTcwYzJhZjRmNTIwYWFlIiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.0-mrZrr6ra5lM80oGIV_LsLE3iWmsb0gNVPQCPPjTgQ)

 (image/png)    


[image2023-11-3_10-53-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDhhMWFkOWEzMzExZGM4OTFkIiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.i0DjiTUZ62XnjYXUpXh2SbrbY_cdVs3ukfspse5I7YM)

 (image/png)    


[image2023-11-3_10-54-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDhhMWFkOWEzMzExZGM4OTFlIiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.lngL5ys43RfgfQNY1OSRT892TyNpI4fOpHPZt6u7c98)

 (image/png)    


[image2023-11-3_10-57-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDg4OTcwYzJhZjRmNTIwYWFmIiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.sTgzgAyuaoJT6MoA8XvA4H-LXrF1p-ttUPrUETdY7EQ)

 (image/png)    


[image2023-11-3_11-27-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDg4OTcwYzJhZjRmNTIwYWIwIiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.T6U_vCivixf7rPg138sx0J1PPGXSO7M_nkNejz6odhk)

 (image/png)    


[image2023-11-3_11-49-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDg4OTcwYzJhZjRmNTIwYWIxIiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.KRFjXBhS0DBahurdG3Xtfxl46lfV6UBvYakl8Hx5ZZs)

 (image/png)    


[image2023-11-3_14-12-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDg4OTcwYzJhZjRmNTIwYWIyIiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.NF0FH8GKaxMv8x4feya1MijT49F89GeuXwvQBtFScIY)

 (image/png)    


[image2023-11-3_19-57-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDhhMWFkOWEzMzExZGM4OTIxIiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.e9HmN-C2nsglwjug2gyZw-zF9KuYYReaeSepdYbxDhA)

 (image/png)    


[image2023-11-3_20-5-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDhhMWFkOWEzMzExZGM4OTIyIiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.tecakHVuZff6--lh7Fea4g8teVi9uda0j7c42K-QzyE)

 (image/png)    


[image2023-11-5_17-7-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDhhMWFkOWEzMzExZGM4OTI1IiwicmVmX2lkIjoiNjczOTZjNDg3MjgyMDZlZmI5MmYxMDBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTU3LCJleHAiOjE3ODIzODY1NTd9.HkE7jbSpdoMKomFzZ2OAWYF51dhsRKvvPHaPNe9Bzt0)

 (image/png)    


## Comments:

|  [](null)  ,cube 顺序一定是从前往后,Posted by liumeixiu at 十一月 06, 2023 17:33|
|---|
|  [](null)  ,后续将支持两阶段：    [分布式Grouping set调研 - 谭思宇 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133578544)  ,Posted by liumeixiu at 十一月 06, 2023 17:47|
|  [](null)  ,与会人：徐晓锋、刘美秀、谭思宇、赵育、张璐恒    
  评审时间：   2023-11-06 17:00 ~ 18:00    
  评审地点：1012,会议主题：分布式支持rollup设计评审    
  评审纪要信息：,1.  后续将支持两阶段：    [分布式Grouping set调研 - 谭思宇 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133578544)      
  2.  cube 顺序一定是从前往后,评审通过与否：通过,Posted by zhangluheng at 十二月 12, 2023 16:40|
