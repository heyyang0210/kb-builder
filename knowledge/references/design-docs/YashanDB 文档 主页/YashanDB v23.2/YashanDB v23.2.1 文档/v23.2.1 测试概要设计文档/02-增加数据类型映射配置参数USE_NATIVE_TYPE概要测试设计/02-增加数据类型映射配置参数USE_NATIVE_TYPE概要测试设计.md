Created by 贺天欢, last modified on 一月 11, 2024

# **适用场景：IR关键特性的测试概要设计文档，用于SR测试设计参照**

IR链接：    [YDBRD-22557](https://jira.yasdb.com/browse/YDBRD-22557?src=confmacro)    -  增加原生数据类型映射配置参数USE_NATIVE_TYPE  验收中

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

增加USE_NATIVE_TYPE配置参数以兼容oracle数据类型，默认为TRUE使用的是原生类型，设置为FALSE则将INT/TINYINT/SMALLINT/BIGINT/FLOAT/类型映射成为oracle对应的NUMBER数据类型，P/S精度也跟ORACLE对齐。

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1. 增加配置参数USE_NATIVE_TYPE，必须为系统级参数命令设置，在control文件生成，不能设置更改
1. USE_NATIVE_TYPE=FALSE时，增加数据类型DTYPE_NUMERIC_FLOAT，在USE_NATIVE_TYPE为FALSE的时候对应float数据类型
1. USE_NATIVE_TYPE=FALSE时，INT/TINYINT/SMALLINT/BIGINT在USE_NATIVE_TYPE为FALSE时映射成number类型，其中P=38，S=0，小数需四舍五入。float(p)类型为DTYPE_NUMERIC_FLOAT，显示的时候仍然按照定义内容显示，但是实际存储为number，scale = ANS_INVALID_SCALE， precision 为定义的值，但是在转成number运算的时候需要将precesion设置为ceil(log10(2^p))(函数内使用全局数组映射)；当不设置p时，默认为float(126)
1. USE_NATIVE_TYPE=FALSE时，float(p)的p转成十进制进行四舍五入，但是最终实现能插入值的范围都是126个bit位，32位字节精度
1. USE_NATIVE_TYPE=FALSE时，视图和系统表有变更，视图涉及如下（int，bigint，smallint，tinyint全变number了，新增的float类型是float，原来的float加binary_前缀）：
1. ALL_TAB_COLS、ALL_ARGUMENTS、ALL_COLL_TYPES、ALL_TYPE_ATTRS
1. DBA_TAB_COLS、DBA_ARGUMENTS、DBA_COLL_TYPES、DBA_TYPE_ATTRS
1. USER_TAB_COLS、USER_ARGUMENTS、USER_COLL_TYPES、USER_TYPE_ATTRS
1. 系统表涉及如下（int，bigint，smallint，tinyint前面加上binary_前缀，系统表里原来就没有float的列？）：
1. CLUSTER_INFO$、GROUP_INFO$、NODE_INFO$
1. LOB$、RECYCLEBIN$
1. SYS.WRH$_SQLSTAT、SYS.WRH$_SQLTEXT
1. 驱动（OCI、C、jdbc、odbc、python）、工具（imp\exp、sqlldr、yasql）的适配数据类型映射和新增的DTYPE_NUMERIC_FLOAT


```


```

**支持返回值float(p)类型的函数**

|函数|语句|返回值|
|:---|:---|:---|
|cast|cast(77 as float(1))|float(1)|


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1.use_native_type配置参数只在建库时生效，不能通过alter命令修改，且只能在yasdb.ini文件中修改

2.float(p), p为二进制位数，取值范围是1到126，默认为126。实际输出结果根据p算出对应的十进制位数进行四舍五入

3.列存暂不支持numeric_float类型，暂不支持创建列式索引

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

flase下，oracle的数据能够导入yashanDB且数据正常，数据库原有类型都能正常定义不会被禁用，只是数据映射，且  INT/TINYINT/SMALLINT/BIGINT/FLOAT值域的变化正确，float(p)存储时候p的转换正确，转换成Number后四则运算正确  。

**1、设置USE_NATIVE_TYPE配置参数方法**

USE_NATIVE_TYPE配置参数是建库级参数，默认值为TRUE，只能在建库时通过yasdb.ini文件设置，且设置后不允许更改。从旧版本升级时，若旧版本已经设置了USE_NATIVE_TYPE为FALSE，则升级后继续保持FALSE；其他情况USE_NATIVE_TYPE均保持为TRUE

详细设置方法如下：

1. 在建库之前，在yasdb.ini文件中设置USE_NATIVE_TYPE参数（如果之前已经建库，则需要先删除旧的数据库，切记要备份文件）
1. 保存yasdb.ini文件，使用nomount模式启动yasdb，使用create database语句创建数据库
1. 建库成功后，可以通过    `show parameter use_native_type;`    语句查询参数是否设置成功


```
-- 例如
USE_NATIVE_TYPE=TRUE
-- 或者
USE_NATIVE_TYPE=FALSE

```

**2、USE_NATIVE_TYPE为FALSE场景**

1. parse阶段，对于INT/TINYINT/SMALLINT/BIGINT，column->typeDesc设置为number类型，precesion设置为38，scale为0；而float类型的column->typeDesc设置为DTYPE_NUMERIC_FLOAT类型，scale = ANS_INVALID_SCALE， precision 为定义的值，但是在转成number运算的时候需要将precesion设置为ceil(log10(2^p))(函数内使用全局数组映射)；默认为其他类型保持不变。
1. 除了insert对DTYPE_NUMERIC_FLOAT需要进行precesion转换(rowAddNumber)，cast函数做applyDesc，pbConvert，rowAddNumericFloat等原先使用codNumberRound地方，将二进制p转成十进制p，其余都与DTYPE_NUMBER保持一致
1. varConvert时，DTYPE_NUMERIC_FLOAT运算与number一致，但是dstType类型仍为DTYPE_NUMERIC_FLOAT；对于cast函数，还会执行applyNumFloatDesc，根据p进行四舍五入。
1. desc显示：使用parse阶段设置的p显示


**3、升级场景**

升级覆盖：低版本升级后查看视图没变（升级前show parameter use_native_type为空，升级后查看为USE_NATIVE_TYPE和true）

场景一、

未包含use_native_type参数的低版本包——》本次含use_native_type的新包      --提单回归成功，验证完毕没问题

期望：升级成功，升级前show parameter use_native_type为空，升级后查看为USE_NATIVE_TYPE和true，且数据类型和原生一致未变

场景二、

包含use_native_type参数的低版本包——》含use_native_type的高版本包 期望：升级前flase的升级后show查看 parameter use_native_type=flase --实际和期望一致，视图问题已确认非问题

升级前.ini文件内true的升级后还是true； -----升级后show parameter use_native_type=true，且数据类型和原生一致未变

升级前yasdb.ini文件内不存在USE_NATIVE_TYPE参数的升级后show parameter use_native_type=true，且视图内和原生一致未变 -----实际和期望一致

##   [5. 概要测试设](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

升级部分，旧版本升级上来不带此参数

参数配置部分，只能设置flase或true，其他会建库失败；

true的情况和不带参数的情况，跑原来的上车没有问题即可

false的情况，原来的数据类型都能正常定义不会报错不支持，且INT/TINYINT/SMALLINT/BIGINT类型的数据映射成number(38,0)在desc查看的时候对应Number(38)，覆盖插入值域是原生类型的值域和现在Number(38,0)的值域范围；float(P)在desc查看的时候对应float(P)，覆盖插入值域是原生类型的值域、超过原生类型值域、现在Number的值域范围。  新增类型的表达式运算、分区键、参与FILTER运算、入参返回数值类型的函数等的测试。

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*不涉及*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

|测试项|自动化看护|看护工程|
|:---|:---|:---|
|功能|是|  [Agile_L2_sa_heap_yasft_use_native_type_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_use_native_type_arm/)      
    [Agile_L2_sa_lsc_yasft_use_native_type_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_use_native_type_arm/)      
    [Agile_L2_sa_tac_yasft_use_native_type_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_use_native_type_arm/)  |
|驱动/工具|是|br22.2_L3_sa_heap_driver_debug_1_native    
  br22.2_L3_sa_heap_driver_debug_2_native    
  br22.2_L2_sa_heap_driver_jdbc_python_debug_arm_native    
  br22.2_L2_sa_heap_driver_c_arm_native    
  br22.2_L2_sa_heap_driver_oci_arm_native    
  br22.2_L2_sa_heap_driver_odbc_arm_native    
  br22.2_L2_sa_FT_expimp_native    
  br22.2_L2_sa_FT_sqlloader_1_native    
  br22.2_L2_sa_FT_sqlloader_2_native    
  br22.2_L2_sa_FT_sqlloader_bcp_native    
  br22.2_L2_sa_FT_yasldr_1_native    
  br22.2_L2_sa_FT_yasldr_2_native    
  br22.2_L2_sa_FT_yasldr_3_native|


  


##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

22.2没有DBLink，23.2有，到23.2合入此功能时候要考虑DBLINK类型对接的测试