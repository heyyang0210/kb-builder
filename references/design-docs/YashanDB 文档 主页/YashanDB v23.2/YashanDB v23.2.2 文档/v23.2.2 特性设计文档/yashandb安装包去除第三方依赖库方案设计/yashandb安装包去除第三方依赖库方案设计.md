Created by 瞿蓝孟, last modified on 四月 28, 2024

SR：    [https://pingcode.yasdb.com/pjm/items/6611a943579a3edb84d86390](https://pingcode.yasdb.com/pjm/items/6611a943579a3edb84d86390)    ?    
  #YDBRD-25923 【安装包】编译脚本支持去除三方依赖库

##   [1. 总述](#1-总述)  

拆分依赖包后，yasdb的包里面不包第三方依赖库的其中gis（libyspi_geometry.so）和oracle驱动（libdrv_oracle.so）最关键。

如果升级前开启了gis，或者配置了oracle dblink的驱动，升级后会出现功能丢失的问题。

###   [1.1 需求来源](#11-需求来源)  

内部识别

###   [1.2 调研文档](#12-调研文档)  

无

###   [1.3 需求分析](#13-需求分析)  

- 确定第三方依赖库的列表
- 确定检查方法


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

安装命令新增--deps，--plugin 参数，用于指定对应依赖包的地址

```
yasboot package install -t hosts.toml -p yashandb-23.2.1.100-linux-x86_64.tar.gz --deps yasdhandb-deps-23.2.1.100-linux-x86_64.tar.gz --plugins yasdhandb-plugins-23.2.1.100-linux-x86_64.tar.gz

--deps 新增参数，依赖库包的路径
--plugin  新增参数，插件包的路径

```

升级命令新增--plugin参数，用于指定依赖包的地址

```
yasboot package upgrade -t hosts.toml -p yashandb-23.2.1.100-linux-x86_64.tar.gz --plugin yasdhandb-plugins-deps-23.2.1.100-linux-x86_64.tar.gz

--plugin  新增参数，插件包的路径


```

##   [3. 规格与约束](#3-规格与约束)  

##   [4. 特性](#4-特性)  

####   [4.1 依赖库列表](#41-依赖库列表)  

第三方库的列表，即目前从yasdhandb的安装包里面取出的第三方库列表。 这个列表的来源是23.1当时安可送检所去除的第三方依赖库。

#####   [4.1.1 企业版去除的库列表](#411-企业版去除的库列表)  

```
lib/ojdbc8.jar
lib/ucp.jar
lib/xstreams.jar
lib/adrci
lib/BASIC_LICENSE
lib/BASIC_README
lib/genezi
lib/libclntsh.so
lib/libclntsh.so.10.1
lib/libclntsh.so.11.1
lib/libclntsh.so.12.1
lib/libclntsh.so.18.1
lib/libclntsh.so.19.1
lib/libclntsh.so.20.1
lib/libclntsh.so.21.1
lib/libclntshcore.so
lib/libclntshcore.so.12.1
lib/libclntshcore.so.18.1
lib/libclntshcore.so.19.1
lib/libclntshcore.so.20.1
lib/libclntshcore.so.21.1
lib/libnnz21.so
lib/libocci.so
lib/libocci.so.10.1
lib/libocci.so.11.1
lib/libocci.so.12.1
lib/libocci.so.18.1
lib/libocci.so.19.1
lib/libocci.so.20.1
lib/libocci.so.21.1
lib/libocci_gcc53.so
lib/libocci_gcc53.so.21.1
lib/libociei.so
lib/libocijdbc21.so
lib/liboramysql.so
lib/SDK_LICENSE
lib/SDK_README
lib/uidrvci
lib/libcurl.a
lib/libycs_c.a
lib/libycs_fault_point.a
lib/libycs_ycr.a
lib/libyfs_fault_point.a
lib/libpcre2-8.a
scripts/initDB.sh
scripts/initStandby.sh
scripts/install.ini
scripts/install.sh
scripts/startup.sh
scripts/stop.sh
bin/yasminer
bin/yasrepair
bin/yfsbenchmark
bin/yfssrv
bin/yfsminer
bin/ycsdump
lib/libnnz19.so
lib/libocijdbc19.so
lib/liboramysql19.so
lib/libaws-s3-c.so
lib/libcrypto.so.1.1
lib/libdrv_oracle.so
lib/libgeos.so
lib/libgeos.so.3.11.1
lib/libgeos_c.so
lib/libgeos_c.so.1
lib/libgeos_c.so.1.17.1
lib/libjni.so
lib/liblz4.so
lib/liblz4.so.1
lib/liblz4.so.1.9.3
lib/libproj.so
lib/libproj.so.25
lib/libproj.so.25.9.1.0
lib/libssl.so
lib/libssl.so.1.1
lib/libz.so
lib/libz.so.1
lib/libz.so.1.2.12
lib/libzstd.so
lib/libzstd.so.1
lib/libzstd.so.1.5.2
plug-in/package/linux/libyspi_geometry.so
ext/bin
ext/monit
ext/static
ext/yasparse

```

#####   [4.1.2 新增插件安装包yashandb-plugins-all-23.2.1.100-xx-linux-x86_64.tar.gz](#412-新增插件安装包yashandb-plugins-all-2321100-xx-linux-x86-64targz)  

里面包含文件：

```
plug-in/package/linux/libyspi_geometry.so
lib/libdrv_oracle.so
lib/libgeos.so
lib/libgeos.so.3.11.1
lib/libgeos_c.so
lib/libgeos_c.so.1
lib/libgeos_c.so.1.17.1
lib/libproj.so
lib/libproj.so.25
lib/libproj.so.25.9.1.0

```

#####   [4.1.3 新增额外依赖包yashandb-deps-23.2.1.100-xx-linux-x86_64.tar.gz](#413-新增额外依赖包yashandb-deps-2321100-xx-linux-x86-64targz)  

里面包含文件：

```
ext/bin
ext/monit
ext/static
ext/yasparse

lib/libssl.so
lib/libssl.so.1.1
lib/libz.so
lib/libz.so.1
lib/libz.so.1.2.12
lib/libzstd.so
lib/libzstd.so.1
lib/libzstd.so.1.5.2
lib/libjni.so
lib/liblz4.so
lib/liblz4.so.1
lib/liblz4.so.1.9.3
lib/libaws-s3-c.so
lib/libcrypto.so.1.1

```

####   [4.2 检查校验](#42-检查校验)  

GIS功能验证，现有master的安装包自带gis的库，使用yasboot安装部署后，连接db查询

```
SQL&gt; select ST_AsLatLonText(ST_GeomFromText('POINT (-3.2342342 -2.32498)')) from dual;

ST_ASLATLONTEXT(ST_G                                             
---------------------------------------------------------------- 
2°19''29.928"S 3°14''3.243"W                                    

1 row fetched.

```

如果使用去除依赖库的安装包安装部署后

```
SQL&gt; select ST_AsLatLonText(ST_GeomFromText('POINT (-3.2342342 -2.32498)')) from dual;

[1:8]YAS-04243 invalid identifier "ST_ASLATLONTEXT"


```

oracle的dblink驱动目前的安装包部署后依然有问题，只有验证前后是否有libdrv_oracle.so 这个库即可。

####   [4.4 部署影响](#44-部署影响)  

安装命令新增检查功能，检查基础依赖库是否已存在，例如openssl，没有直接报错退出，提示用户安装依赖，或者使用yashandb-dep包进行安装。

#####   [4.4.1用户机器已经安装好基础依赖包，有对应的lib库](#441用户机器已经安装好基础依赖包有对应的lib库)  

执行yasboot package install -t hosts.toml -i yashandb.tar.gz命令，可以正常安装

#####   [4.4.2用户机器没有安装好基础依赖包，有对应的lib库](#442用户机器没有安装好基础依赖包有对应的lib库)  

执行yasboot package install -t hosts.toml -i yashandb.tar.gz命令，报错缺少依赖库，提示用户安装依赖

- 用户没有网络隔离，用户自行安装
- 用户有网络隔离，无法使用yum命令，使用


```
yasboot package install -t hosts.toml -p yashandb-23.2.1.100-linux-x86_64.tar.gz --deps yasdhandb-deps-23.2.1.100-linux-x86_64.tar.gz 

```

#####   [4.4.3 gis相关功能](#443-gis相关功能)  

如果用户需要使用gis相关功能，则需要在前面的基础上，额外使用--plugin参数来使用plugin包进行配置

```
yasboot package install -t hosts.toml -p yashandb-23.2.1.100-linux-x86_64.tar.gz --plugins yasdhandb-plugins-23.2.1.100-linux-x86_64.tar.gz

--plugin  新增参数，插件包的路径

```

手动配置gis的流程

- 手动将plugin包解压到YASDB_HOME目录下
- .配置文件YASDB_HOME\plug-in\package\package.in中加上 PACKAGE1 = {library = yspi_geometry, name = /, schema = public}


####   [4.4 升级改造](#44-升级改造)  

升级改造：

- 升级前检查：检查旧版本YASDB_HOME/lib目录下是否有第三方库（libyspi_geometry.so和libdrv_oracle.so）存在
    - 如果存在列表中任意一项。
        - 检查是否有指定--plugin参数，如果没指定，则直接报错。
    - 如果不存在列表任意一项。
        - 没有指定--plugin参数，直接使用新的yashandb安装包升级，升级后没有第三方库；
        - 有指定--plugin参数，自动在升级过程中将deps解压到新版本的lib目录下；


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1.升级前使用23.2sit出包版本安装部署，检查gis功能和libdrv_oracle.so，使用转测包升级，升级后，gis功能正常和libdrv_oracle.so存在。

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

  
    
    
    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：瞿蓝孟，李世铭，刘美秀    
  会议时间：2024/4/22 15:30-16:00    
  会议地点：线上    
  纪要信息：    
  1.转测的包版本号不能是现在的版本，要能支持升级,2.安装的时候可以指定plugin参数来配置gis功能，安装部署后(开始没配置gis)，是否提供命令用户一键配置gis。,已补充手动配置文档，不提供命令,3.测试预估4天，到28-29合入是否可以？,可以，但是不能超过29号,Posted by qulanmeng at 四月 16, 2024 10:22|
|---|
