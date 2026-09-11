Created by 李子怡, last modified by  化明虎 on 十月 14, 2024

IR链接：    [YDBRD-940](https://jira.yasdb.com/browse/YDBRD-940?src=confmacro)    -  支持本地物化视图  完成     SR链接：    [https://jira.yasdb.com/browse/YDBRD-14372](https://jira.yasdb.com/browse/YDBRD-14372)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#1-overview%E6%A6%82%E8%BF%B0)  

本次特性范围仅支持物化视图的基础ALTER功能，其他功能后续演进； 部署模式限制：

- 特性支持的部署形态为  主备(单机)   （其他部署形态视后续演进支持）
- 单机行执行 （列执行后续演进支持）


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|设计表现|设计说明|
|---|---|---|
|物化视图ALTER|物化视图能够通过提供的语法修改对应属性|修改后属性修改正确，物化视图功能正常|


(2) SQL语法有关的功能特性设计，需要给出语法图或EBNF，说明各语法分支的具体含义。不支持的分支可以不提及，但只做了语法兼容的分支，要给出显著而且明确的说明。

支持语法：ALTER MATERIALIZED VIEW  <materialized view name>【ALTER TABLE  <materialized view name>当前不支持】

语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396b378970c2af4f5202bf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBUUFBQUFTQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFCQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFFQUVBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQWdFQVFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE5NDUsImV4cCI6MTc4MjMwMjc0NX0.TH85NPY-j2j8Knx04ITu1WeSL8gInZEYCstl5ZLrlog)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396b37a1ad9a3311dc8137/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBUUFBQUFTQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFCQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFFQUVBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQWdFQVFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE5NDUsImV4cCI6MTc4MjMwMjc0NX0.TH85NPY-j2j8Knx04ITu1WeSL8gInZEYCstl5ZLrlog)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396b37a1ad9a3311dc8138/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBUUFBQUFTQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFCQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFFQUVBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQWdFQVFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE5NDUsImV4cCI6MTc4MjMwMjc0NX0.TH85NPY-j2j8Knx04ITu1WeSL8gInZEYCstl5ZLrlog)

  


【特别注意：以下表格罗列仅支持语法，无功能支撑的部分说明，特此强调】

|功能|调研表现|
|---|---|
|alter_mv_refresh_properties|修改刷新功能的相关属性|
|alter_query_rewrite_clause|修改query rewrite 启用或禁用属性|


  


|修改类型|测试场景|用例|输出结果|
|---|---|---|---|
|rename|物化视图重命名|alter materialized view alter_materialized_view_action_my1 rename to alter_mv_action_my1;|YAS-02397 cannot rename a materialized view,与oracle保持一致：,ORA-32318: cannot rename a materialized view|
|refresh force|将刷新类型修改为force|  `ALTER MATERIALIZED VIEW alter_materialized_view_action_my1 REFRESH FORCE;`  |Succeed.|
|refresh fast |将刷新类型修改为fast|  `ALTER MATERIALIZED VIEW alter_materialized_view_action_my1 REFRESH FAST;`  |YAS-00004 feature "fast refresh materialized view" has not been implemented yet,ORA-12015: cannot create a fast refresh materialized view from a complex query|
|refresh complete|将刷新类型修改为complete|  `ALTER MATERIALIZED VIEW alter_materialized_view_action_my1 REFRESH COMPLETE;`  |Succeed.|
|never refresh|将刷新类型修改为never|  `ALTER MATERIALIZED VIEW alter_materialized_view_action_my1 NEVER REFRESH;`  |Succeed.|
|refresh on demand|将刷新模式修改为on demand|  `ALTER MATERIALIZED VIEW alter_materialized_view_action_my1 REFRESH on demand;`  |Succeed.|
|refresh on commit|将刷新模式修改为on commit|  `ALTER MATERIALIZED VIEW alter_materialized_view_action_my1 REFRESH on commit;`  |Succeed.|
|refresh on statement|将刷新模式修改为on statement|  `ALTER MATERIALIZED VIEW alter_materialized_view_action_my1 REFRESH on statement;`  |on-statement materialized join view error: Refresh fast not specified,约束：on statement 场景一定是 refresh fast,ORA-32428: on-statement materialized join view error: Cannot alter an MV to    
  refresh on statement|
|refresh start with|修改刷新开始时间|ALTER MATERIALIZED VIEW alter_materialized_view_action_my1 refresh start with sysdate;|Succeed. |
|refresh next|修改刷新间隔时间|  `ALTER MATERIALIZED VIEW alter_materialized_view_action_my1 refresh next sysdate;`  |Succeed. |
|refresh start with ...next..|修改刷新时间|  `ALTER MATERIALIZED VIEW alter_materialized_view_action_my1 refresh start with sysdate next sysdate + 10/(2460);`  |Succeed. |
|enable query rewrite|启用query rewirte|alter MATERIALIZED VIEW alter_materialized_view_action_my1 enable query rewrite;|Succeed.|
|disable query rewrite|禁用query rewirte|alter MATERIALIZED VIEW alter_materialized_view_action_my1 disable query rewrite;|Succeed.|


组合情况1：

|type+mode/query rewrite|force|fast|complete|never|
|---|---|---|---|---|
|demand|√|×（约束1）|√|×（约束3）|
|commit|√|×（约束1）|√|×（约束3）|
|statement|×（约束2）|×（约束1）|×（约束2）|×（约束3）|
|query rewrite |√|×（约束1）|√|√|


  


组合情况2：

|type/query rewrite+time|force|fast|complete|never|query rewrite|
|---|---|---|---|---|---|
|start with|√|×（约束1）|√|×（约束3）|√|
|next|√|×（约束1)|√|×（约束3）|√|
|start with...next...|×（约束2）|×（约束1）|×（约束2）|×（约束3）|√|


  


组合情况3:

|mode+time/query rewrite|demand|commit|statement|
|---|---|---|---|
|start with|√|×（约束4）|×（约束2）|
|next|√|×（约束4）|×（约束2）|
|start with...next...|√|×（约束4）|×（约束2）|
|query rewrite|√|√|×（约束2）|


  


说明：

约束1：refresh fast当前未实现

约束2：on statement场景一定是refresh fast

约束3：修改为never refresh后再指定refresh的模式或时间不合理，语法解析报错

约束4：on commit场景不能和start with...next...一起使用

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出本方案对外提供的接口、配置参数、API等。

**1.SQL语法，必须给出EBNF。禁止描述不存在的分支。**

语法图在第二部分已说明，重点说明本特性中特有的部分：

语法ENBF：

ALTER 语法：

ALTER_MATERIALIZED_VIEW=ALTER MATERIALIZED VIEW [schema"."] materialized_view_name (alter_mv_refresh_properties | alter_query_rewrite_clause) .

refresh属性：

alter_mv_refresh_properties= (REFRESH [(FAST | COMPLETE| FORCE)|( ON DEMAND |ON COMMIT| ON STATEMENT)| (START WITH date| NEXT date)] | NEVER REFRESH) .

query rewrite的启用与禁用：

alter_query_rewrite_clause= (ENABLE | DISABLE) QUERY REWRITE .

**2.与数据库的功能相关的系统表、系统视图和配置参数，需要罗列，给出设计说明。**

alter refresh属性：

会修改系统表MATERIALIZED_VIEW$ 中的  REFRESH_MODE， REFRESH_TYPE,  DDL_TIME字段

query rewrite的启用与禁用：

会修改系统表MATERIALIZED_VIEW$ 中的property对应的enableRewrite

  


添加了三个视图：dba_mviews, all_mviews和 user_mviews

相关dba视图说明:

dba_mviews

|字段|说明|
|---|---|
|OWNER|物化视图owner名字|
|MVIEW_NAME|物化视图名字|
|REFRESH_MODE|物化视图刷新模式|
|REFRESH_METHOD|物化视图刷新类型|
|DDL_TIME|物化视图发生DDL的时间戳|
|REWRITE_ENABLED|是否启用query rewrite|


all_mviews

|字段|说明|
|---|---|
|OWNER|物化视图owner名字|
|MVIEW_NAME|物化视图名字|
|REFRESH_MODE|物化视图刷新模式|
|REFRESH_METHOD|物化视图刷新类型|
|DDL_TIME|物化视图发生DDL的时间戳|
|REWRITE_ENABLED|是否启用query rewrite|


user_mviews

|字段|说明|
|---|---|
|MVIEW_NAME|物化视图名字|
|REFRESH_MODE|物化视图刷新模式|
|REFRESH_METHOD|物化视图刷新类型|
|DDL_TIME|物化视图发生DDL的时间戳|
|REWRITE_ENABLED|是否启用query rewrite|


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明本方案对外的功能规格或约束。

本方案仅支持物化视图更改，支持其中语法图中提供的所有语法兼容；

功能限制：

- 不支持刷新功能。
- 不支持权限控制
- 不支持其他DDL，无法支持的会报错，不影响使用的会成功


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#51-architecture%E6%9E%B6%E6%9E%84)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考**  ** **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** **  **）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考**  ** **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** **  **）。用于支撑测试方案的灰盒测试。**

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

有新增系统表和索引，其他旧版本使用需要走升级脚本。

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#54-dfx%E8%AE%BE%E8%AE%A1)  

备机可以访问物化视图；

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#55-%E5%85%B6%E4%BB%96)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

自测基础场景：

1. 语法组合测试
1. 正常创建+修改+删除系统表维护内容测试
1. 备机可以访问物化视图


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

- 后续演进支持列存和其他形态部署
- 后续迭代开发物化视图权限控制


  


## Attachments:

[image2023-7-7_20-30-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzY4OTcwYzJhZjRmNTIwMmJhIiwicmVmX2lkIjoiNjczOTZiMzY3MjgyMDZlZmI5MmYwMmZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxOTQ1LCJleHAiOjE3ODIzNzgzNDV9.VNreQBfrB34lRM65jFXarrbPM2iQgP6izUkP5KjoS0s)

 (image/png)    


[image2023-7-7_18-44-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzZhMWFkOWEzMzExZGM4MTMxIiwicmVmX2lkIjoiNjczOTZiMzY3MjgyMDZlZmI5MmYwMmZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxOTQ1LCJleHAiOjE3ODIzNzgzNDV9.eLK8dxxvPkRrioW3uodzhu2J4jBDD7xH1lynw9sQFi0)

 (image/png)    


[image2023-6-27_14-55-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzZhMWFkOWEzMzExZGM4MTMzIiwicmVmX2lkIjoiNjczOTZiMzY3MjgyMDZlZmI5MmYwMmZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxOTQ1LCJleHAiOjE3ODIzNzgzNDV9.iJZ7wAUw0hzk2wYQmMBSwDCn5kgT_L7q-15TV3MGPyM)

 (image/png)    


[image2023-6-21_17-8-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzc4OTcwYzJhZjRmNTIwMmJkIiwicmVmX2lkIjoiNjczOTZiMzY3MjgyMDZlZmI5MmYwMmZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxOTQ1LCJleHAiOjE3ODIzNzgzNDV9._ixEQpq_lG-FpyxC2PBS7ZANsCUHibpaTyPpwXbknog)

 (image/png)    


[image2023-6-21_9-40-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzdhMWFkOWEzMzExZGM4MTM2IiwicmVmX2lkIjoiNjczOTZiMzY3MjgyMDZlZmI5MmYwMmZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxOTQ1LCJleHAiOjE3ODIzNzgzNDV9.VWREr3VEF1UI-ZnfINUzuH86av-jBXv-CXPPziVEJmg)

 (image/png)    
