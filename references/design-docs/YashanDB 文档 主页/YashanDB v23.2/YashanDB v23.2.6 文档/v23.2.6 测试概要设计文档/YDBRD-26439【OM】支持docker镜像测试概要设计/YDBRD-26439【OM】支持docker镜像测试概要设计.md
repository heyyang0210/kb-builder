Created by 刘美秀, last modified on 九月 06, 2024

  


IR：     *IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b295](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b295)    *?*    
  *#YASHAN-837 支持docker镜像版本*

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

需求概述：（1）  打包docker镜像版本  （2）  OS版本为CentOS 7.x版本，平台支持X86、ARM

需求来源：产品化需求

部署形态：单机

需求场景：

（1）  X86、ARM下使用docker镜像安装个人版、正式版

  


##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

- 支持打包docker镜像版本
- OS版本为CentOS 7.x版本，平台支持X86、ARM
- 支持个人版、正式版


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

- 仅支持单机单节点


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

参考以上需求场景描述

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

**当前特性**

DB基础功能验证

验证平台：

- x86
- arm


路径验证：

- 宿主机挂载的目录下存在yasdb_home和yasdb_data目录–拦截
- 指定路径为绝对路径、相对路径


配置校验  --合法值、非法值

- DB_BLOCK_SIZE


可靠性：

- 失败可回滚
- docker重启后数据库内数据不会丢失


易用性：资料-包括创建，启动、启动后登录数据库

  


**关联特性**

插件功能：

- gis
- dblink


依赖包功能：

- s3
- lz4-建表空间指定压缩方式为lz4


升级：版本升级

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

|类型|测试项|
|:---|:---|
|可靠性|失败可回滚|


  


##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

|测试项|自动化看护|框架|
|:---|:---|:---|
|功能|是|install_test|
|业务|是|  
|
|DFX|是|  
|
|性能|否|  
|


  


##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

重点关注业务背景下，主备数据的一致性、事务的一致性

升级前后，配置、业务一致

  
