Created by 郑荃, last modified on 三月 04, 2024

# **1. 概述**

 物化视图是一种特殊的物理表，“物化”(Materialized)视图是相对普通视图而言的。普通视图是虚拟表，应用的局限性大，任何对视图的查询，Oracle都实际上转换为视图SQL语句的查询。这样对整体查询性能的提高，并没有实质上的好处。和视图仅保存SQL定义不同，物化视图本身会存储数据，因此是物化了的视图。

物化视图是一种数据库内重要的关键特性，它与普通视图最大的区别是拥有一份自己的持久化数据，用以包装和保存一些复杂查询的结果集。 当后续有诉求对某种复杂查询进行分析、查询改写时，可以直接使用物化视图中的快照数据

物化视图是一个包含了查询结果集的数据库对象，主要用于：

1. 查询加速： 直接查询物化视图或通过视图进行query rewrite，通常要提供fast refresh on commit的能力
1. 一种数据复制的方式，可以提供本地访问的能力： 结合dblink，可以将远程master database的数据定期同步到本地materialized view databases，应用查询直接访问本地database，可以降低响应时间和网络负载、提升可用性
1. 提供细粒度的权限控制方式： 不直接开放master table的访问权限，通过物化视图访问特定数据集
1. 异构归档： 从交易数据异构归档为分析数据，一般是complete refresh on demand


# **2. 需求分析**

**物化视图是一种数据库内重要的关键特性，它与普通视图最大的区别是拥有一份自己的持久化数据，用以包装和保存一些复杂查询的结果集。 当后续有诉求对某种复杂查询进行分析、查询改写时，可以直接使用物化视图中的快照数**

SR:     [YDBRD-13581](https://jira.yasdb.com/browse/YDBRD-13581?src=confmacro)    -  支持物化视图的create/drop  完成

开发设计：    [物化视图CREATE/DROP设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889)  

### create materialized view

![](https://conf.yasdb.com/download/attachments/113972889/create_materialiazed_view.GIF?version=1&modificationDate=1686553542000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAxMTYsImV4cCI6MTc4MjIyMDkxNn0.7jrtNqI12fWQr6WVHqGkNRgJfDNkR9jpbYiX_YE4GWQ)

![](https://conf.yasdb.com/download/attachments/113972889/create_mv_refresh_clause.GIF?version=1&modificationDate=1686554393000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAxMTYsImV4cCI6MTc4MjIyMDkxNn0.7jrtNqI12fWQr6WVHqGkNRgJfDNkR9jpbYiX_YE4GWQ)

### drop materialized view

![](https://conf.yasdb.com/download/attachments/113972889/drop_materialiazed_view.GIF?version=1&modificationDate=1686555039000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAxMTYsImV4cCI6MTc4MjIyMDkxNn0.7jrtNqI12fWQr6WVHqGkNRgJfDNkR9jpbYiX_YE4GWQ)

- 创建物化视图可以指定schema、tablespace，其他存储属性暂时不支持指定
- build分支语法【仅语法支持，无刷新功能】
    - build immediate：指创建时即完成一次全量数据刷新，填充数据并持久化
    - build deferred： 指创建时仅完成定义创建，不刷新数据
- create mv refresh子句【仅语法支持，无刷新功能】
    - 刷新类型选项
        - fast：快速刷新（增量）
        - complete：全量刷新
        - force：优先快速，如快速刷新不可用则切换为全量刷新
    - 刷新模式选项
        - on demand：根据手动命令或高级包刷新
        - on commit：事务提交时刷新相关联物化视图
        - on statement：跟随DML语句刷新
    - 定时刷新选项
        - start with date：指定第一次刷新定时时间
        - next date：指定刷新间隔时间
    - 指定不刷新：never refresh


  


**新增4个系统表**

|系统表|内容说明|
|:---|:---|
|MATERIALIZED_VIEW$|物化视图基础系统表，记录物化视图相关的属性和信息|
|MV_REFOP$|根据物化视图属性而自动生成的物化视图刷新操作相关信息|
|MV_REFTIME$|记录物化视图刷新动作相关信息|
|SUM_DETAIL$|记录物化视图相关master table信息|


# **3. 测试**  **设计方法**   

### 3.1测试对象范围：

- 单机、HA、分布式、集群部署形态，分布式和集群应该拦截
- 存储表结构包括heap、swf（tac,lsc），列存本轮不支持拦截
- 主表的类型涉及：普通表、分区表、临时表、派生表、视图（普通视图、物化视图、dba视图、动态视图）
- 物化视图和基表的表空间：自定义表空间、mms、bucket、加密表空间、压缩表空间
- 数据类型：整数、浮点、  字符、raw、lob、rowid、时间、枚举


### 本文主要测试create/drop的基本语法，针对不同参数创建后的功能生效，包括其使用中的约束进行验证。主要采用的测试设计方法有

①等价类划分法

主要用来测试基本语法，根据view的语法规则，列出所有可能的输入，划分有效等价类和无效等价类，将有效等价类组合测试，无效等价类单独测试，该方法中会穿插使用边界值法，正交实验法

### 3.2语法验证

### create materialized view

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|视图名称|合法名称|1、纯字母,2、字母数字组合,3、字母、数据、特殊字符组合|非法名称|1、使用关键字,2、和已有的其他对象重名,3、超过最大长度,4、以字母或者特殊字符开头,5、缺失视图名称|
|是否指定scheam|不带schema|  
|schema不存在|  
|
|  
|当前用户的schema|  
|  
|  
|
|  
|其他用户的schema|  
|  
|  
|
|BUILD|IMMEDIATE|创建物化视图的时候立即构建数据|方式错误|  
|
|  
|DEFERRED|创建物化的时候不构建数据，第一次刷新时构建|  
|  
|
|  
|不指定方式|默认IMMEDIATE|  
|  
|
|REFRESH|FAST|  
|方式错误|  
|
|  
|COMPLETE|  
|  
|  
|
|  
|FORCE|  
|  
|  
|
|  
|不指定方式|默认 FORCE|  
|  
|
|ON|COMMIT|主表数据commit刷新数据物化视图数据|方式错误|  
|
|  
|DEMAND|只能通过手动或者设置的时间定时刷新|  
|  
|
|  
|不指定方式|默认DEMAND|  
|  
|
|START WITH|时间值校验：sysdate,sysdate之前，sysdate之后； |DEMAND或者默认方式|sysdate之前（是报错，还是自动修正到sysdate）|  
|
|  
|数据类型校验：date,timestamp,time ;default值校验；时间日期格式校验（date_format）; 时间日期函数表达式||COMMIT方式|  
|
|  
|特殊值：sysdate,systimestamp,current_timestamp，current_date,||NULL,'',空，null|  
|
|  
|  
||在start with时刻，数据库状态不可用，（read_only,mount,nomount,shutdown）,恢复到open状态后可以正常执行吗，是否会执行恢复之前的任务|  
|
|NEXT|表达式内容和计算结果校验：需要能够换算成下次执行时间|  
|表达式内容和计算结果校验：不能换算的报错|  
|
|  
|  
|  
|特殊值 null,'',空 ，特殊字符、负数|  
|
|  
|  
|  
|小于间隔时间|  
|
|  
|  
|  
|interval小于，等于 单词刷新所需要的时间|  
|
|  
|  
|  
|无START WITH 时有NEXT|  
|
|  
|  
|  
|有START WITH无NEXT|数据库只会刷新物化视图一次|
|  
|  
|  
|同时无START WITH和NEXT|  
|
|WITH|PRIMARY KEY--master table有主键|  
|PRIMARY KEY---master table 无主键列|  
|
|  
|不指定默认PRIMARY KEY|  
|PRIMARY KEY--只有部分master table有主键列|  
|
|  
|ROWID--master table为单表|  
|ROWID--master table为多表|  
|
|  
|  
|  
|ROWID-查询中包含distinct、aggr、group by、subquery、join|  
|
|  
|  
|  
|包含主键列|  
|
|QUERY REWRITE|ENABLE |不带START WITH和NEXT|ENABLE|带START WITH和NEXT|
|  
|默认DISABLE|  
|  
|  
|
|关键字验证|只带必选关键字|  
|关键字错误、关键字缺失|  
|
|  
|带部分的可选关键字|  
|  
|  
|
|  
|带全部的关键字|  
|  
|  
|
|  
|关键字大写、小写、大小写组合|  
|  
|  
|
|select|带列别名|  
|  
|  
|
|  
|不带列别名|  
|  
|  
|
|  
|1个投影|  
|0个投影|  
|
|  
|多个投影（含索引，带default值）|  
|列名不存在|  
|
|  
|*，所有列（覆盖所有数据类型），给*后再增加一列|  
|虚拟列|  
|
|  
|投影列为算数表达式（+, -, *, /,%）|  
|闪回查询|  
|
|  
|投影列为比较表达式（>, <, =, <>, >=, <=）|  
|  
|  
|
|  
|投影列为逻辑表达式（&，|，^）|  
|  
|  
|
|  
|投影列为函数表达式（聚合函数）|  
|  
|  
|
|  
|投影列为函数表达式（其他函数）|  
|  
|  
|
|  
|DISTINCT column|  
|  
|  
|
|  
|伪列|  
|  
|  
|
|from |单张表（包括视图）|  
|不存在的表|  
|
|  
|多张表（包括视图）|  
|不存在的视图|  
|
|  
|  
|  
|  
|  
|
|where|简单条件（>, <, =, <>, >=, <=,in,between and,exists,like）|  
|  
|  
|
|  
|复合条件（and, or）|  
|  
|  
|
|grop by|带group by|  
|  
|  
|
|  
|不带group by|  
|  
|  
|
|order by|带order by|  
|  
|  
|
|  
|不带order by|  
|  
|  
|
|join|INNER JOIN|  
|  
|  
|
|  
|OUTER JOIN|  
|  
|  
|
|  
|CROSS JOIN|  
|  
|  
|
|union/union all|union|  
|  
|  
|
|  
|union all|  
|  
|  
|
|limit|limit|  
|  
|  
|
|  
|limit...offset|  
|  
|  
|
|查询结果|小表|  
|  
|  
|
|  
|大表|  
|  
|  
|
|  
|空表|  
|  
|  
|
|查询执行计划|全表扫描|  
|  
|  
|
|  
|索引扫描|  
|  
|  
|
|  
|回表的方式|  
|  
|  
|


### drop     materialized     view

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|是否指定用户|不指定用户，默认为当前session的用户|  
|指定为不存在的用户|  
|
|  
|指定当前的schema|  
|删除不存在的视图，或者已经被删除成功的视图|  
|
|  
|指定其它的schema|  
|删除视图的时候缺少materialized关键字|  
|
|  
|  
|  
|无删除物化视图的权限|  
|


②错误推测法

从用户的角度出发，考虑用户视图的实际使用场景，我们列出可能出错的场景，对这些场景进行单独测试

|分类|场景|预期结果|备注|
|:---|:---|:---|:---|
|查询|删除视图依赖的对象，查询物化视图|  
|  
|
|  
|删除视图依赖的对象后，再创建一个同名的对象|  
|1、同名的对象缺少某些投影列,2、同名的对象包含全部投影列|
|  
|修改视图所依赖的对象|  
|1、修改列的数据类型,2、增加列,3、删除列（投影列、非投影列）|
|  
|master table存在未提交的事务，相同/不同的session创建/刷新视图，进行查询|  
|  
|
|  
|带视图的查询，关注执行计划|  
|  
|
|  
|视图和表，视图join查询|  
|  
|
|  
|查询的视图（dba视图、系统表、动态视图）|  
|测试中可以用于辅助观察的视图（user_mviews）|
|  
|查询时给视图起别名|  
|  
|
|  
|desc 查询物化视图的结构|  
|  
|
|ddl/dml|对物化视图做dml操作|  
|  
|
|  
|修改物化视图结构|  
|  
|
|  
|给物化视图创建索引|  
|  
|
|  
|其他的表创建外键reference物化视图|  
|  
|
|约束限制|不能在定义查询的选择列表中定义带有子查询的物化视图|  
|  
|
|  
|as select 中有闪回查询会报错|  
|  
|
|  
|不能包含数据类型为LONG或 的列LONG RAW|  
|  
|
|  
|不能在临时表上创建物化视图日志|  
|  
|
|  
|不能包含虚拟列|  
|  
|
|  
|开启重写不能带start with 和next|  
|  
|
|  
|如果基于主表的rowid创建查询中包含distinct、aggr、group by、subquery、join|  
|  
|
|异常场景|一次更新的数据量很多，到next时间未更新完|  
|  
|
|  
|基于rowid创建物化视图， shrink table或者跨分区更新，导致rowid变更|  
|  
|
|  
|基表在透明/加密表空间，物化视图在普通表空间|  
|  
|
|  
|基表在普通表空间，物化视图在压缩/加密表空间|  
|  
|
|  
|创建物化视图后，重启yasdb，重启后物化视图功能正常，查看系统表数据正确|  
|  
|
|其他功能交互|给视图创建同义词，对同义词进行select、dml操作|  
|  
|
|  
|在存储过程中对物化视图进行select、dml操作|  
|  
|
|  
|对物化视图进行闪回dml、闪回查询、shrink table|  
|  
|
|  
|开启回收站，对物化视图truncate、drop 操作后再恢复|  
|  
|
|  
|删除user、删除tablespace对应的物化视图也会被删除，动态视图中查询不到|  
|  
|
|规格|视图列规格，最大投影个数?|  
|  
|
|  
|视图定义语句长度|  
|  
|
|  
|子嵌套的上限|  
|  
|
|HA|主机创建物化视图，备机上查询视图，物化视图数据更新后再进行查询|  
|  
|
|  
|带物化视图，做备份， 再更新主表数据并更新物化视图后做恢复|  
|  
|
|  
|主备倒换后，在新主上查看物化视图，并对物化视图进行更新后再次查询|  
|  
|
|CT/KT|多个session同时对基表进行dml操作，触发commit更新|  
|  
|
|  
|多个session并发对基表做DML操作，同时并发手动更新/定时刷新|  
|  
|
|  
|并发创建和删除物化视图|  
|  
|
|  
|在定时触发刷新的同时，手动进行刷新|  
|  
|
|一致性|对基表并发dml，同时对物化视图进行一致性校验|  
|  
|
|升级|升级前创建master table ，升级后在master的基础上创建物化视图、删除物化视图|  
|  
|


### 3.5专项覆盖

|专项|是否涉及|说明|
|:---|:---|:---|
|并发|涉及|  
|
|长稳|涉及|  
|
|一致性|涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR/testkill|涉及|  
|
|HA|涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|
|兼容性|不涉及|  
|
|升级|涉及|  
|


# 4.   **详细测试设计**   

[支持物化视图create_drop测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWU4OTcwYzJhZjRmNTFmYjNjIiwicmVmX2lkIjoiNjczOTY5ZWU1OTNmOTljOWZmMjM1NDJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMTE2LCJleHAiOjE3ODIyOTY1MTZ9.jz13wxmS5ds9n1ETWSfR9MmlgGWNNlaAcn7fxwZ1wxo)

# 5.   **测试用例**

[支持物化视图create_drop测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWU4OTcwYzJhZjRmNTFmYjNkIiwicmVmX2lkIjoiNjczOTY5ZWU1OTNmOTljOWZmMjM1NDJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMTE2LCJleHAiOjE3ODIyOTY1MTZ9.CYqMve8KbclE0KIiySBI75dFsaHlVXbF1Ebo5sqwY10)

# 6.   **测试框架设计**

自动化用例添加到regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[支持物化视图create_drop测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWU4OTcwYzJhZjRmNTFmYjNjIiwicmVmX2lkIjoiNjczOTY5ZWU1OTNmOTljOWZmMjM1NDJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMTE2LCJleHAiOjE3ODIyOTY1MTZ9.jz13wxmS5ds9n1ETWSfR9MmlgGWNNlaAcn7fxwZ1wxo)

 (application/vnd.xmind.workbook)    


[支持物化视图create_drop测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWU4OTcwYzJhZjRmNTFmYjNkIiwicmVmX2lkIjoiNjczOTY5ZWU1OTNmOTljOWZmMjM1NDJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMTE2LCJleHAiOjE3ODIyOTY1MTZ9.CYqMve8KbclE0KIiySBI75dFsaHlVXbF1Ebo5sqwY10)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
