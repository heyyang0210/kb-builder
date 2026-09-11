Created by 何阳, last modified by  冯浩楠 on 一月 25, 2024

JIRA：    [YDBRD-13888](https://jira.yasdb.com/browse/YDBRD-13888?src=confmacro)    -  支持直连DN导入数据强一致性  完成

## 1. Overview（概述）

   隔一段时间，GTS服务同步SCN到各个节点上，因此在这段时间窗内，各个节点上的SCN可能是不一致的，会存在多CN不是立即可读的问题。同理，对于数据导入，在这个时间窗内，也可能存在直连DN导入数据之后，在CN上查询数据不是立即可读的。因此需要支持一个命令，强制同步SCN到各个节点上。

## 2. Features（功能特性）

   将CN上的SCN强制推进到跟MN节点SCN一致。在必要场景下使用强制同步SCN的语句，比如：多CN立即可读，或者数据导入之后，查询数据等场景下使用，其他场景不需要执行此语句去强制同步SCN。

## 3. Interfaces（接口）

ALTER   SYSTEM FLUSH GTS;

## 4. Limitations（功能限制）

1. 执行这个SQL语句，只保证把当时MN上的SCN同步到CN节点
1. 单机不支持此语法，只有在CN节点上才能执行这个语句


## 5. Detail Design（详细设计）

### 5.1 执行流程

![](https://pingcode.yasdb.com/atlas/files/public/67396b338970c2af4f5202a2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE4NjYsImV4cCI6MTc4MjMwMjY2Nn0.cOTh2qKXmZHEe3bZlSZajVYffDGcmqGiKLdqEohFLQQ)

   执行步骤：

1. CN节点服务端收到  ALTER SYSTEM FLUSH GTS  语句，解析，校验
1. 获取CN本地SCN，发送ICS_CMD_GET_SCN消息到MN节点
1. MN节点收到获取SCN消息，比对MN本地SCN(当前时戳生成)和CN发送过来的SCN+1,返回最大的SCN到CN节点
1. CN收到ICS_CMD_GET_SCN_ACK，刷新本地SCN，然后将ALTER SYS消息发送给其他CN节点，等待回应
1. 其他CN节点收到ALTER SYS消息，刷新SCN，然后返回ACK消息给CN节点
1. CN返回成功消息给客户端


**在导入工具数据导入后，为了CN节点上能够达到立即可读能力，需要在导入工具完成导入，返回给用户之间，增加一个强制同步GTS的SQL命令**

### 5.2 并行执行

1. 并发执行强制同步GTS的语句时，CN节点会刷新此时最大的SCN到本节点上，在MN节点上可能存在抢锁行为
1. ALTER SYSTEM FLUSH GTS  和  COMMIT  语句存在并发抢锁问题，可能在MN节点上拿取SCN时抢锁，不过出现锁冲突概率比较小，因为MN节点上获取SCN的锁范围很小


### 5.3 故障恢复

1. 只涉及到CN和MN节点，在执行同步GTS的SQL时，DN异常，无影响。
1. 部分CN节点异常时，异常CN节点未刷新SCN，正常节点能够成功刷新SCN，SQL语句最终返回失败
1. 其他故障处理跟修改配置参数一致


### 5.4 DFX

   此种语句隶属于修改配置参数的DCL命令，使用场景比较简单，不需要额外增加DFX能力

  


### 5.5 数据结构

```
typedef enum EnAlterSysAction {
    ALTER_SYS_SET,           // alter system set
    ALTER_SYS_CHECKPOINT,
    ALTER_SYS_FLUSH,
    ALTER_SYS_SWITCH_LOG,
    ALTER_SYS_ARCHIVE,
    ALTER_SYS_EXTEND,
    ALTER_SYS_KILL,
    ALTER_SYS_CANCEL,
    ALTER_SYS_IGNORE_REDO,
    ALTER_SYS_DUMP_LOGFILE,
    ALTER_SYS_DUMP_DATAFILE,
    ALTER_SYS_DUMP_BACKTRACE,
    ALTER_SYS_FLUSH_GTS, // 新增枚举类型
} AlterSysAction;

```

  


  


  


## 6. Testcases（自测用例）

--- 用例A (脚本多次执行)    
  --- 0.将BROADCAST_GTS_TIME调整到1000    
  ​    
  --- 1.导入工具导入数据    
  ​    
  --- 2.执行同步SCN语句    
  ​    
  --- 3.执行查询导入数据，预期能够立即查询到导入的数据，跟直连DN查询的条数一致    
  ​    
  --- 用例B(脚本多次执行)    
  --- 0.将BROADCAST_GTS_TIME调整到1000    
  ​    
  --- 1.在CN1节点上建表插入多条数据，然后执行提交操作    
  ​    
  --- 2.切换到CN2，执行查询语句，预期可能出现数据不一致的问题    
  ​    
  --- 3.执行同步SCN语句，然后执行查询语句，预期数据一致

## 7. Workload（工作量）

代码量在0.2KLOC左右，工作量4人天

## 8. TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[YDBRD-13888 刷新GTS.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzNhMWFkOWEzMzExZGM4MTE3IiwicmVmX2lkIjoiNjczOTZiMzM3MjgyMDZlZmI5MmYwMmNmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxODY2LCJleHAiOjE3ODIzNzgyNjZ9.EXC--s0bTWD_R_Cra306yRCh8aQmYsgvTAX3vnjGNDg)

 (image/png)    
