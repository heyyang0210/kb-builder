Created by 王博文 on 四月 29, 2024

IR链接：    [支持DBMS_XA内置系统包](https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ceb3?)    SR链接：    [支持DBMS_XA内置系统包](https://pingcode.yasdb.com/pjm/items/66263dccfd997db58adf0aac?)  

##   [1. Overview（概述）](#1-overview概述)  

需求    [支持XA事务接口](https://jira.yasdb.com/browse/YDBRD-21460)    实现了 XA 事务的存储接口设计。

本需求场景兼容 oracle，方案旨在通过调用上述接口，设计 DBMS_XA 子程序，包括 XA_START() 等内置高级包函数。

##   [2. Interfaces（接口）](#2-interfaces接口)  

通过内置高级包 DBMS_XA 调用如下函数。

|函数|功能|参数|返回值|使用yasdb存储接口|
|---|---|---|---|---|
|  [XA_START](https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/DBMS_XA.html#GUID-61B54B33-22CE-4860-95FA-5B6490FC7119)  |1. 连接当前会话与 xid 指定的事务分支，该事务分支可能不存在或已存在；
1. 只有返回成功时，调用该函数的应用才可进行其它操作。
|xid, flag|PLS_INTEGER|xaStart(AnkHandler* handler, Gtid* gtid, CodUint64 flags)|
|  [XA_END](https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/DBMS_XA.html#GUID-AF35D417-FCAF-4076-8C3F-EEDA9B9B964E)  |1. 断连当前会话与 xid 指定的事务分支；
1. 成功返回后，调用线程与事务分支不再连接但事务分支仍存在。
|xid, flag|PLS_INTEGER|xaEnd(AnkHandler* handler, Gtid* gtid, CodUint64 flags)|
|  [XA_PREPARE](https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/DBMS_XA.html#GUID-F19AA44E-5B1D-45BF-8B5B-2079E07CB3B1)  |1. 准备 xid 指定的事务分支以便后续进行可能的提交；
1. 若操作其他用户创建的事务分支，需要 FORCE ANY TRANSACTION 权限；
1. 应用必须跟踪一个全局事务的所有分支，并 prepare 每个事务分支；
1. 仅当所有事务分支成功 prepare 并且函数返回成功时，应用才可调用 XA_COMMIT。
|xid|PLS_INTEGER|xaPrepare(AnkHandler* handler, Gtid* gtid, CodUint64 flags)|
|  [XA_COMMIT](https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/DBMS_XA.html#GUID-E183C7FF-6818-430B-B92D-7691DC9F8153)  |1. 提交 xid 指定的全局事务；
1. 若提交其他用户创建的事务分支，需要 FORCE ANY TRANSACTION 权限；
1. 应用若提交全局事务，必须调用 XA_COMMIT而非 commit；
1. 若 onePhase 为 true，RM 使用单阶段提交协议来提交 xid 完成的内容。否则，只有全局事务的所有分支都已成功准备并且 XA_PREPARE 成功返回后，才应调用 XA_COMMIT；
1. 对于全局事务中 XA_PREPARE 已成功返回的每个分支，应用必须分别调用 XA_COMMIT；
1. 若 RM 未提交事务并且 onePhase 为 true，RM 将返回 XA_RB*，返回时 RM 已完成回滚并且分支资源已释放。
|xid, onePhase|PLS_INTEGER|xaCommit(AnkHandler* handler, Gtid* gtid, CodUint64 flags)|
|  [XA_RECOVER](https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/DBMS_XA.html#GUID-4EBFF4D3-BAC8-4BF4-9573-1270786FC1CE)  |1. 从 RM 尝试获得已完成的事务分支的列表；
1. 调用 XA_RECOVER 必须有 SELECT ON DBA_PENDING_TRANSACTIONS 权限。
|/|DBMS_XA_XID_ARRAY|/|
|  [XA_FORGET](https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/DBMS_XA.html#GUID-7C7ED6D4-AE4B-45BE-B23B-F918FD49F8AA)  |1. 告知 RM 遗弃已提交或回滚事务分支。
|xid|PLS_INTEGER|xaForget(AnkHandler* handler, Gtid* gtid, CodUint64 flags)|
|  [XA_ROLLBACK](https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/DBMS_XA.html#GUID-AB177806-535A-4221-B678-0A5630289AEC)  |1. 告知 RM 回滚已完成的 xid 事务分支；
1. 若回滚其他用户创建的事务分支，需要 FORCE ANY TRANSACTION 权限。
|xid|PLS_INTEGER|xaRollback(AnkHandler* handler, Gtid* gtid, CodUint64 flags)|


##   [3. Features（功能特性）](#3-features功能特性)  

###   [数据结构](#数据结构)  

（1）DBMS_XA_XID

oracle:

```
TYPE DBMS_XA_XID IS OBJECT(
	formatid NUMBER,
	gtrid RAW(64),
	bqual RAW(64),
	constructor function DBMS_XA_XID(
			gtrid IN NUMBER)
		RETURN SELF AS RESULT,
	constructor function DBMS_XA_XID (
			gtrid IN RAW,
&nbsp; &nbsp; &nbsp; &nbsp; bqual IN RAW)
		RETURN SELF AS RESULT,
	constructor function DBMS_XA_XID(&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 
			formatid IN NUMBER,
			gtrid IN RAW,
			bqual IN RAW DEFAULT HEXTORAW('00000000000000000000000000000001'))
		RETURN SELF AS RESULT)

```

|参数|说明|
|---|---|
|formatid|用于区分事务管理器（TM）的标识符，NUMBER|
|gtrid|唯一区分全局事务的标识符，RAW(64)|
|bqual|事务分支标识符，RAW(64)|


yasql:

```
typedef struct StGtid {
    CodUint16 gtidLen;
    CodChar   data[ANK_GTID_DATA_SIZE];
} Gtid;

```

（2）DBMS_XA_XID_ARRAY

```
TYPE DBMS_XA_XID_ARRAY as TABLE of DBMS_XA_XID

```

###   [flag](#flag)  

|flag|作用函数|描述|
|---|---|---|
|TMNOFLAGS|XA_START|在当前线程启动新的事务分支，其中xid未被使用|
|TMJOIN|XA_START|重连已被分离的分支，其中分离时flag为TMSUCCESS|
|TMRESUME|XA_START|重连已被分离的分支，其中分离时flag为TMSUSPEND|
|TMSUCCESS|XA_END|断连当前线程的事务分支|
|TMSUSPEND|XA_END|断连当前线程的事务分支，仅挂起不结束|


注：1、使用不符合的flags，函数返回值-5：无效参数

2、TMJOIN、TMRESUME对分离使用的flag无要求

###   [函数返回值](#函数返回值)  

调用的存储接口使用 YASDB 错误码，需封装对齐 oracle 高级包函数的返回值。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

仅支持单机。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

```
declare
    ret int;
    xid DBMS_XA_XID := DBMS_XA_XID(1);
begin
    ret := DBMS_XA.XA_START(xid, DBMS_XA.TMRESUME);  
	IF ret = 0 THEN  
		DBMS_OUTPUT.PUT_LINE('XA transaction started successfully.');  
	ELSE
		DBMS_OUTPUT.PUT_LINE('XA transaction start failed with return code: ' || ret);  
	END IF;  
end;

```

```
declare
    ret int;
    xid DBMS_XA_XID := DBMS_XA_XID(1);
begin
    ret := DBMS_XA.XA_PREPARE(xid);  
	DBMS_OUTPUT.PUT_LINE(ret);
	ret := DBMS_XA.XA_COMMIT(xid, FALSE);
	DBMS_OUTPUT.PUT_LINE(ret);
end;

```

```
declare
    ret int;
    xid DBMS_XA_XID := DBMS_XA_XID(1);
begin
    ret := DBMS_XA.XA_END(xid, DBMS_XA.TMSUCCESS);
	IF ret = 0 THEN
		DBMS_OUTPUT.PUT_LINE('XA transaction ended successfully.');  
	ELSE
		DBMS_OUTPUT.PUT_LINE('XA transaction end failed with return code: ' || ret);  
	END IF;
end;

```

##   [6.资料设计章节](#6资料设计章节)  

需在路径“开发手册/PLSQL参考手册/内置高级包/”中添加 DBMS_XA.md，对新增的内置高级包函数原型、用法进行介绍。