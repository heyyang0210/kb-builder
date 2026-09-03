

*文档标题格式：YDBRD-36531 : package support verify Design（【OM】安装时支持安装包自校验功能特性设计） *

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/675bf54f622069d46df83c5e](https://pingcode.yasdb.com/pjm/items/675bf54f622069d46df83c5e)  ?  
#YDBRD-36531 【OM】安装时支持安装包自校验功能



# 1 简介



## 1.1 目的

在安装部署阶段，我们的安装包要有手段能识别安装包被篡改了，而且要自动发现，不能让用户自行确认。



## 1.2 范围

背景：在新的安装包结构下新增对安装包自校验的功能。

使用范围：部署/升级时，对安装包的正确性进行校验。同时提供单独的命令校验安装包。



# 2 特性需求概述

当前安装包目录：

```
$ tree
.
├── bin
│   └── yasboot -> ../om/bin/yasboot	 # yasboot软链接
├── database-23.2.8.100-linux-x86_64.tar.gz # 数据库包
├── depends			# 第三方依赖包
│   └── third
│       └── gmssl
│           └── libgmssl.so.3.1
├── install.sh		# 安装脚本
├── om
│   ├── bin
│   │   ├── fio
│   │   ├── iperf
│   │   ├── monit
│   │   ├── yasagent
│   │   ├── yasbak
│   │   ├── yasboot
│   │   ├── yasom
│   │   └── yasparse
│   ├── conf
│   │   ├── database_options.json
│   │   ├── sqlcollect.toml
│   │   ├── sqlhtml.template
│   │   ├── yasreport.template
│   │   ├── ycs_options.json
│   │   └── yfs_options.json
│   ├── monit
│   │   └── monitrc.template
│   └── static
│       ├── assets
│       │   ├── Deploy-029c9a31.js
│       │   ├── Deploy-6c6c3ef1.css
│       │   ├── favicon-c096f8ac.ico
│       │   ├── index-35481a7f.js
│       │   └── index-cbe189b5.css
│       └── index.html
├── plugins # plugin压缩包
│   ├── aws-s3-sdk-c-1.11.142.tar.gz
│   ├── jni.tar.gz
│   ├── yashandb-plugin-dblink-1.3.1-linux-x86_64.tar.gz
│   └── yashandb-plugins-1.2.3-linux-x86_64.tar.gz


```



解决问题：当前没有安装包的识别防篡改能力。



# 3 需求场景分析（可选）



## 3.1 需求来源

内部识别



## 3.2 价值概述

让用户可以识别拿到的安装包是否被篡改。



## 3.3 特性场景分析

1. 部署时。
1. 升级时。
1. 单独使用yasboot命令进行校验。




## 3.4 特性影响分析

描述该特性在整个系统中的位置及周边接口，与其他需求及特性的交互分析，兼容性分析，安全性分析等。

下面给出DFX维度的特性影响CheckList，特性设计中针对本特性的设计范围进行分析。

|维度|说明|
|---|---|
|安全性|*如果安装包校验没有通过，则无法进行安装*|
|易用性|*正常使用用户不感知*|
|兼容性|*从旧版本升级到新版本，因package upgrade需要使用新版yasboot，所以新版本具备识别防篡改能力。如果使用旧版yasboot，虽然没有防篡改能力，但也无法执行升级步骤（因为安装包结构有变动）。*|




## 3.5 外部依赖分析（可选）

不涉及。



## 3.6 业内方案分析（可选）

1. 包管理器通常使用GPG方式，安装包所有者在上传安装包时可以选择上传自己的公钥，由包管理器进行校验
1. C/S或者B/S模式的，可以在通信请求参数带上在服务端校验。


以包管理器来看，以下两点存在问题：

1. 如果篡改者把包管理器篡改，则可以绕过
1. 手动安装程序，不通过包管理器安装




综合看，主流的方式也是在约定的前提下保证包不被篡改。如果一开始安装的包管理器就是被篡改的，是无法解决

所以这个需求的目标，应该是  **具备安装部署时可初步校验即可，增加破解成本**  。



# 4 特性设计



## 4.1 总体方案

1. 在编译阶段随机生成一堆公私钥
1. 对安装包进行计算hash值，使用私钥对hash值加密
1. 将私钥丢弃，公钥和加密后的hash值写入yasboot
1. 安装时，yasboot通过公钥解密hash值，对安装包计算hash值，进行对比是否一致。不一致报错
1. yasboot支持命令直接校验是否被篡改




除非篡改者可以通过以下方式篡改：

1. 获取我们源码，重新编译一个yasboot（只能发生在红区出现漏洞）
1. 按照yasboot方式自行实现一遍（成本高）
1. 不使用yasboot，手动安装数据库




1. 使用golang的FS能力，将所有资源打包到一个可执行文件里。获取安装包时是一个可执行程序。运行该可执行程序会将数据库压缩包还原回来，边还原边使用公钥校验。




### 4.1.1 特性功能设计

1. 新增接口：yasboot package verify


调用示例：

$ yasboot package verify



### 4.1.2 整体流程设计



**编译**

1. 打包时，生成密钥对，获取文件列表。
1. 重新编译yasboot。使用go嵌入文件的功能，将fn.sort（文件列表）, public.pem（公钥）, sign.b64（哈希值）嵌入到yasboot。




**校验**

1. 获取fn.sort, public.pem, sign.b64，  yasboot通过公钥解密hash值，对安装包计算hash值，进行对比是否一致






# 5 资料设计

yasboot package



# 6 自测用例设计

1. 不修改安装包，直接部署，部署成功；
1. 已安装旧版本，使用新版本升级，升级成功。
1. 修改安装包内容，使用yasboot package verify，报错。




# 7 参考资料清单



