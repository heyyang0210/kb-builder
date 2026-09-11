Created by 张志鹏 on 一月 19, 2024

  


#   [YDBRD-13465: Sequence currval design](#ydbrd-13465-sequence-currval-design)  

IR链接：YDBRD-XXXX / SR：    [https://jira.yasdb.com/browse/YDBRD-13465](https://jira.yasdb.com/browse/YDBRD-13465)  

##   [1. Overview（概述）](#1-overview概述)  

支持获取sequence.currval(当前session上次获取到的nextVal.)

##   [2. Features（功能特性）](#2-features功能特性)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|设计表现|设计说明|
|---|---|---|
|sequence.currval|返回当前session上次获取到的nextVal，若当前session并未获取过对应sequence的nextval,报错|行为解释说明|


create sequence s1;    
  create sequence s2;    
  select s1.currval from dual; (报错) s1.currval 未定义    
  select s1.nextval from dual; 返回s1.nextval（假设为1）    
  select s1.currval from dual; 返回s1.currval (返回1）。    
  当一个查询出现同一session的currVal与nextVal时，如select s1.currval, s1.nextval from dual时，currval与nextVal返回同样的值，相当于先执行nextVal,再执行currVal.    
  select s1.currval, s1.nextval from dual;(返回2， 2)。

##   [3. Interfaces（接口）](#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

**1.函数或者表达式特性。**

对外接口表达式：sequenceName.currval

**2.SQL语法**    
  create sequence语法见    [https://conf.yasdb.com/pages/viewpage.action?pageId=89096161](https://conf.yasdb.com/pages/viewpage.action?pageId=89096161)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

sequenceName.currVal的取值范围与sequence.nextVal的取值返回相同。    
  当前架构备机上获取不了nextVal，也获取不了currVal，报错特性不支持。    
  本设计文档只针对单机架构，见SR：    [https://jira.yasdb.com/browse/YDBRD-13465](https://jira.yasdb.com/browse/YDBRD-13465)     分布式不支持currval,报错特性不支持。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

1. 当执行sequence.nextVal表达式时，获取获取nextVal返回,并将此次获取的nextVal存在handler上的seqCurrVals list（本特性新增逻辑）. 根据步长推sequence新的nextVal(已有逻辑）。
1. handler上的seqCurrVals list 生命周期跟随session, 退出释放内存。
1. 当一个查询出现同一sequence的currVal与nextVal时，如select s1.currval, s1.nextval from dual时，会最终把s1.nextval加入预投影链表.预投影时取s1.nextval,然后实际s1.currval与s1.nextVal取同一预投影值。
1. 当一个查询中出现不同sequence的nextVal与currVal组合时，预投影时先执行currVal的expr（因为获取currVal需要当前session已获取过nextVal，因此可能未定义报错，这种情况直接返回）,然后再执行nextVal的expr.


###   [5.1 Architecture（架构）](#51-architecture架构)  

略

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

略

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

不涉及兼容性

###   [5.4 DFX设计](#54-dfx设计)  

session缓存的对不同sequence currVal链表随session退出释放，无内存泄漏。sequence.currval几乎完全不影响性能。

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：create sequence s1;    
  create sequence s2;    
  /** error   **/select s1.currval from dual;**    
  **/**   1   **/select s1.nextval from dual;**    
  **/**   error   **/select s2.currval, s1.currval from dual;**    
  **/**   error   **/select s1.nextval, s2.currval from dual;**    
  **/**   2, 1, 1   **/select s1.nextval, s2.currval, s2.nextval from dual;**    
  **/**   3, 3, 2, 2 **/select s1.currval, s1.nextval, s2.currval, s2.nextval from dual;

自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。1.产品描述/与Oracle兼容性说明中说明需要修改

2.开发手册-SQL参考手册-SQL基本元素-伪列中增加sequence伪列currval和nextval

3.在create sequence通用描述中提示sequence的用法（链接到伪列）

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-4-20_11-34-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDVhMWFkOWEzMzExZGM3YmU4IiwicmVmX2lkIjoiNjczOTZhNDU1OTNmOTljOWZmMjM1ODUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMzgyLCJleHAiOjE3ODIyOTg3ODJ9.xYl9BIgpEQ0qU4gfQ_4Lm16xYP5nRI5Dxg3lAofgGZs)

 (image/png)    
