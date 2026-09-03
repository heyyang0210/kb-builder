Created by 张鹏飞, last modified by  郑荃 on 七月 18, 2024

主要场景：

（1）、创建一个普通用户，授予其某个Schema的特定权限，查看授权记录。

（2）、测试授权后，该用户是否可执行相应操作。

（3）、撤销schema级授权，查看授权记录。

（4）、测试撤销授权后，用户是否仍可执行相就操作。

（5）、级联授权与撤销。

（6）、删除用户（包括grantee、grantor)，授权记录是否被清理

## 2.3 规格约束

1. 不支持一次授予多个权限
1. 不支持将权限一次授予多个用户
1. 不支持将权限授予角色
1. MySQL权限在YashanDB没有对等权限的，不能通过与MySQL完全一致的语法进行授权
1. MySQL模式仅支持单机主备，因此本需求仅支持单机主备。


# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用等价类、错误推测法进行测试

## 3.2 详细测试设计

### 3.2.1语法测试

（1）grant schema_privilege on schema.* to user

|接口|测试分类|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|grant schema_privilege on schema.* to user|MySQL语法|1、MySQL权限名称（大、小、混合写）,2、用户名（大、小、混合写）,3、Schema名称（大、小、混合写）,4、WITH GRANT OPTION|  
|1、权限不存在,2、MySQL权限存在，但崖山不支持,2、用户不存在,3、Schema不存在,4、WITH ADMIN OPTION,  
|  
|
||兼容语法|1、YashanDB权限名称（大、小、混合写）|  
|1、不存在的YashanDB系统权限,2、不能作为schema级权限的系统权限|  
|
||权限类型|ALL,DML：,- SELECT
- DELETE
- INSERT
- UPDATE
- MERGE INTO
- SELECT FOR UPDATE
,DDL:,- CRATE/ALTER/DROP TABLE
- CREATE/ALTER/DROP PROCEDURE
- CRETAE/DROP/ALTER INDEX
- CREATE/DROP VIEW
|  
|  
|  
|
||schema权限生效范围|1、授权后，对schema中已有对象生效,2、授权后，对schema中新建对象生效|  
|  
|  
|
||Grantor|1、拥有Grant Any Schema Privileges权限的用户,2、高级别角色（dba),3、Schema的owner,4、被授予过权限的用户（WITH GRANT OPTION）|  
|1、没有Grant Any Schema Privileges权限的用户,2、有授权，但没有WITH GRANT OPTION|  
|
||Grantee|1、授权给未授权的用户,2、授权给已授权的用户|  
|1、授权给角色|  
|
|grant schema_privilege on * to user|语法|  
|  
|  
|  
|
|revoke schema_privilege on schema.* from user    
    
    
    
|MySQL语法|1、MySQL权限名称（大、小、混合写）,2、用户名（大、小、混合写）,3、Schema名称（大、小、混合写）|  
|1、权限不存在,2、MySQL权限存在，但崖山不支持,2、用户不存在,3、Schema不存在|  
|
||兼容语法|1、YashanDB权限名称（大、小、混合写）|  
|1、不存在的YashanDB系统权限,2、不能作为schema级权限的系统权限|  
|
||Revoker|1、拥有Grant Any Schema Privileges权限的用户,2、高级别角色（dba),3、Schema的owner,4、被授予过权限的用户（WITH GRANT OPTION）|  
|1、没有Grant Any Schema Privileges权限的用户,2、有授权，但没有WITH GRANT OPTION|  
|
||Revokee|1、撤销已授权用户的权限|  
|1、撤销未授权用户的权限,2、撤销曾经授权，但已被撤销授权的用户的权限|  
|
||权限|1、授权MySQL权限，撤销MySQL权限,2、授权MySQL权限，撤销对等的YashanDB权限,3、授权YashanDB权限，撤销对等MySQL权限,4、授权YashanDB权限，撤销对等YashanDB权限|  
|1、撤销未授予过的权限,2、授予和撤销时分别采用崖山和mysql权限名称，并且权限不对等|  
|
|revoke schema_privilege on * from use|  
|  
|  
|  
|  
|
|其他|drop user|1、drop grantor，权限保留,2、drop schema，授权记录删除,3、drop grantee，授权记录删除|  
|  
|  
|


### 3.2.2 涉及的测试DFX

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是|
|DFR|/|
|HA|是|
|KT kill测试|是|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|/|
|长稳|/|


（3）集群：不单独再设计测试点，上面的用例，挑选用例，同一用例，不同步骤，放置在不同的实例下执行

（4）并发+testkill设计



|测试点|验证场景|预期|
|---|---|---|
|HA|1、主机赋权，备机查看视图，还有相关权限,2、主机收回权限，备机也对应收回权限，不能进行相关操作|1、备机查看视图相关的权限，可以查看到已经有相关权限，如果主机赋权select权限，备机可以查询|
|并发|并发授权和回收权限（各种不同的权限混合）+相关业务并发 （带kill+不带并发）|  
|


# 4.  **测试用例**

# 5.  **测试框架设计**

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现

# 6.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# **7. 工作量评估**

工作量：X  *人天*

计划测试完成时间：

## Comments:

|  [](null)  ,待确认，重复授权是否会报错,Posted by zhangpengfei at 七月 18, 2024 10:49|
|---|
