Created by 王林, last modified on 十月 18, 2024

# 1 概述

    审计是维护数据库安全的一个必不可少的功能。通过配置不同的审计项，针对指定用户的指定行为进行审计记录，达到能够方便快捷查询指定用户操作的具体内容，维护数据库的安全性。

对于不再需要保留的审计记录，提供了高级包 DBMS_AUDIT_MGMT来进行处理，通过创建定时任务，周期性删除指定时间段之前的数据。通过子存储过程DROP_PURGE_JOB删除审计清理定时任务。

# 2 功能特性

## 2.1 语法

通过子存储过程DROP_PURGE_JOB实现清理审计定时任务。语法如下：

```
DBMS_AUDIT_MGMT.DROP_PURGE_JOB(
   audit_trail_purge_name IN VARCHAR2) ;
```

参数说明：

audit_trail_purge_name ：审计清理定时任务名称

# 3 接口

内部间接调用DBMS_SCHEDULER.DROP_JOB来实现清理审计定时任务的功能。

# 4 功能限制

无

# 5 详细设计

DBMS_AUDIT_MGMT是通过SQL语句实现，定义见system_packages.sql文件。drop_purge_job实现如下：

```
PROCEDURE DROP_PURGE_JOB(audit_trail_purge_name IN VARCHAR)
    AS
    BEGIN
        DBMS_SCHEDULER.DROP_JOB(audit_trail_purge_name);
    END;
```

## 5.1 权限

DBMS_AUDIT_MGMT是sys用户下的高级包，用户使用该高级包需要被赋予执行该高级包的权限才可以执行。

## 5.2视图

DBA_AUDIT_MGMT_CLEANUP_JOBS   ： 查看已创建的审计清理定时任务。

## 5.3 同义词

无

## 5.4 表设计

无

## 5.5 缓存信息结构

无

  


# 6 自测用例

```
--创建审计清理定时任务
BEGIN
  DBMS_AUDIT_MGMT.CREATE_PURGE_JOB (
    DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED,
    sysdate + 1,
    'sysdate + 1/(24*6)',
    'Audit_Trail_PJ1',
    TRUE);
END;
/

--查看
select * from DBA_AUDIT_MGMT_CLEANUP_JOBS;

-- 删除清理定时任务

--NULL参数
BEGIN
    DBMS_AUDIT_MGMT.DROP_PURGE_JOB('');
END;
/
-- 不存在的定时任务
BEGIN
    DBMS_AUDIT_MGMT.DROP_PURGE_JOB('Audit_Trail_PJ2');
END;
/

--大小写
BEGIN
    DBMS_AUDIT_MGMT.DROP_PURGE_JOB('Audit_Trail_pj1');
END;
/

BEGIN
    DBMS_AUDIT_MGMT.DROP_PURGE_JOB('Audit_Trail_PJ1');
END;
/
--查看
select * from DBA_AUDIT_MGMT_CLEANUP_JOBS;
```

  


# 7 资料

  [审计概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141572275)  

  [审计详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=76912654)  

  [审计日志清理](https://conf.yasdb.com/pages/viewpage.action?pageId=95107699)  

《PL/SQL Packages and Types Reference》中 “29.7.8 DROP_PURGE_JOB Procedure” 章节。

  [概要设计文档：DBMS_AUDIT_MGMT内置系统包支持DROP_PURGE_JOB子函数](150628666.html)  

# 8 工作量

  


# 9 遗留问题

  


  


  


  


  
