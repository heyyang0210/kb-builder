Created by 张璐恒, last modified by  许中立 on 一月 30, 2024

##   [](#1overview概述)      [1、Overview（概述）](http://cod-conf.sics.com/pages/resumedraft.action?draftId=68293708&draftShareId=ade20d11-3df2-42cc-b6b8-5cee456ac992&)  

row movement功能允许数据的存储位置发生改变，该特性为跨分区更新功能提供支持。当用户将数据存在一个分区表中，如果更新数据时会引起分区变化，则需要row movement功能的支持。

##   [](#2features功能特性)      [2、features（功能特性）](http://cod-conf.sics.com/pages/resumedraft.action?draftId=68293708&draftShareId=ade20d11-3df2-42cc-b6b8-5cee456ac992&)  

参考单机的设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=89082209&version=2.5.50000.157&platform=win](https://conf.yasdb.com/pages/viewpage.action?pageId=89082209&version=2.5.50000.157&platform=win)  

##   [](#3interfaces接口)      [3、interfaces（接口）](http://cod-conf.sics.com/pages/resumedraft.action?draftId=68293708&draftShareId=ade20d11-3df2-42cc-b6b8-5cee456ac992&)  

通过sql语句提供功能

##   [[开启row movement功能]](#开启row-movement功能)  

enable row movement 该语句用于开启row movement功能。

用户根据需要在建表后执行本SQL语句来开启row movement功能：

```
alter table TABLE_NAME enable row movement;

```

**TABLE_NAME**  ：表名。

**enable row movement**   开启row movement功能。

示例

```
create table TABLE1(key int) organization heap;
alter table TABLE1 enable row movement;

```

##   [[关闭row movement功能]](#关闭row-movement功能)  

disable row movement 该语句用于关闭row movement功能。

删除语句

```
alter table TABLE_NAME disable row movement;

```

示例

```
alter table TABLE1 disable row movement;

```

##   [](#4limitations功能限制)      [4、limitations（功能限制）](http://cod-conf.sics.com/pages/resumedraft.action?draftId=68293708&draftShareId=ade20d11-3df2-42cc-b6b8-5cee456ac992&)  

- 用户建表时默认不开启row movement功能，需要用户通过sql语句手动打开一致性开关。
- 需要row movement开启的情况有闪回DML、shrink table和跨分区更新。分布式目前支持的rowId发生变化的场景只有一种：tac表的跨分区更新。
- 跨分区更新在分布式上表现为支持dn节点内的跨分区更新，不涉及跨节点，即不能更新分布键。
- 目单机只有tac表和heap表支持开启、关闭row movement，lsc表不支持开启，分布式下不支持heap，因此只有tac支持开启row movement。
- 其余约束与当前alter table保持一致。


##   [](#5design方案设计)      [5、design（方案设计）](http://cod-conf.sics.com/pages/resumedraft.action?draftId=68293708&draftShareId=ade20d11-3df2-42cc-b6b8-5cee456ac992&)  

设置row movement走单机流程，分布式下仅特殊处理分布键拦截和语句重启，现对这两部分加以说明。

##   [[分布键拦截]](#分布键拦截)  

在verifyUpdateTables中对分布表进行判断，将update的列id与分布键逐一比较，判断是否有重合。

##   [[语句重启]](#语句重启)  

单机流程参考：    [row movement - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/row+movement)  

分布式语句重启步骤

1. 事务1在dn执行delete、update、merge等操作加锁时发现行的版本 > 查询语句的版本，触发current rowid fetch。
1. 事务1读取最新版本，发现最新版本不存在，报错误码ERR_ANK_CONSISTENT_WRITE，dn返回报错给cn。
1. cn收到报错，anlExecute中根据错误码判断需要重新执行。


以update和delete并发为例：

![](https://pingcode.yasdb.com/atlas/files/public/67396b258970c2af4f520218/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFRQUFBQUFBQWdBQUFBQUFBQUFRQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTEzMDMsImV4cCI6MTc4MjMwMjEwM30.zuRtDqlVmdY2N7MhL8rOAWHFdTcVly6HKLLkmmFtQjE)

主要代码：

```
//dn上
if (codGetErrorCode() == ERR_ANK_CONSISTENT_WRITE) {
        if (anlIsDn(stmt-&gt;handler-&gt;inst) &amp;&amp; stmt-&gt;dstbStmt != NULL) {
            return COD_ERROR;
        }
}

//cn上
static CodBool anlExecuteNeedRetry(CodError errCode)
{
    if (errCode == ERR_ANK_CONSISTENT_WRITE) {
        return COD_TRUE;
    }
    return COD_FALSE;
}

```

##   [](#6testcases测试)      [6、Testcases（测试）](http://cod-conf.sics.com/pages/viewpage.action?pageId=68293708)  

##   [](#row-movement测试)      [row movement测试](https://conf.yasdb.com/pages/viewpage.action?pageId=89089300#row-movement%E6%B5%8B%E8%AF%95)  

###   [](#测试项目)      [测试项目](https://conf.yasdb.com/pages/viewpage.action?pageId=89089300#%E6%B5%8B%E8%AF%95%E9%A1%B9%E7%9B%AE)  

测试用例中包括部分分布式暂不支持的场景，待支持后需要刷新测试预期。

1. 测试row movement开启情况下tac的跨分区更新能否成功。
1. 测试开启关闭row movement开关时，系统表是否更新成功。
1. 测试row movement开启情况下tac的跨分区更新如果发生需要语句重启的情况，能否正常语句重启。


##   [](#7documents资料)      [7、Documents(资料)](http://cod-conf.sics.com/pages/viewpage.action?pageId=68293708)  

  [支持跨分区更新方案设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=89082209&version=2.5.50000.157&platform=win)  

  [跨分区更新 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=68293708)  

  [row movement - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/row+movement)  

## Attachments:

[clipbord_1685431762380.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMjU4OTcwYzJhZjRmNTIwMjE2IiwicmVmX2lkIjoiNjczOTZiMjU1OTNmOTljOWZmMjM1ZTcyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMzAzLCJleHAiOjE3ODIzNzc3MDN9.MajaTCgTlPwSGaEYL9jZ-_h9B10J7EoaSm3HdrN-VsU)

 (image/png)    


## Comments:

|  [](null)  ,遗留问题：    [YDBRD-11971](https://jira.yasdb.com/browse/YDBRD-11971?src=confmacro)    -  【row movement】分布式上不应该支持row movement，需要拦截  解决关闭,需要支持分布式“  语句重启  ”,Posted by liyi at 四月 26, 2023 09:59|
|---|
|  [](null)  ,execSingleTableUpdate,if (codGetErrorCode() == ERR_ANK_CONSISTENT_WRITE) {    
  codCleanError();    
  ankMiniRollback(stmt->handler->khdlr, &point);    
  return restartSingleTableUpdate(stmt, table, scanPlan, plan->ds);    
  },Posted by liyi at 四月 26, 2023 15:27|
|  [](null)  ,v$sql & v$sqlarea 显示的plan cache中的信息，当前从分布式下发的SQL在DN上没有加入到plan cache中，所以dv$sql & dv$sqlarea当前无法显示DN的数据 （anl_serialize.c：2022.1.19 ） ,Posted by liyi at 四月 27, 2023 10:56|
|  [](null)  ,语句重启的情况下30s（后期改到可配置）报错,后面考虑优化，重启的时候先锁数据集，已经加成功的行不放锁，减少回滚的开销（分布式下可能会有死锁）。,Posted by zhangluheng at 五月 31, 2023 12:18|
|  [](null)  ,需要row movement开启的情况新增了lsc表 冷数据更新（    [[YDBRD-12227] 分布式LSC表支持更新功能 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-12227)    ），删除和更新冷数据也存在锁冲突导致语句重启的情况。,Posted by zhangluheng at 六月 07, 2023 20:38|
