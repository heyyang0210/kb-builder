Created by 李潮, last modified on 十月 12, 2024

**目的：**    
  1.牵引TSE理解特性，熟悉特性的主要能力、规格、约束、应用场景等    
  2.牵引TSE在研发设计评审中能给出有效意见(如识别特性行为、规格、约束与友商的重大差异，关联能力缺漏)    
  3.给测试概要设计和测试详细设计做输入

# 1. 需求概述

IR：    [YDBRD-23034](https://jira.yasdb.com/browse/YDBRD-23034?src=confmacro)    -  jdbc发布maven  完成

解决的问题是：目前在使用 mvn 时，yashandb 的 jdbc 驱动 jar 包，只能配置本地的 jar，mvn 仓库上没有 yashandb jdbc jar 包，需要将 yashandb jdbc jar 包上传到 mvn 仓库上，并随版本一起发布；

# 2. 友商的实现情况

  


mvn 发布流程：    [发布/上传Jar包到Maven中央仓库 - 史上最详细_oss.sonatype.org-CSDN博客](https://blog.csdn.net/ttzommed/article/details/114697533)  

针对使用者(测试人员) 来说，使用 mvn 可以配置 mvn 仓库，不配置本地 jar 包来使用 yashandb 的 jdbc 驱动；

# 3. 示例

*pom.xml 文件中可以配置 mvn 库中的 yashandb 驱动的依赖，而不是本地目录*

  pom.xml

<dependency>    
     <groupId>org.testng</groupId>    
     <artifactId>testng</artifactId>    
     <version>6.14.2</version>    
  </dependency>    
  <dependency>    
     <groupId>yasdb-jdbc</groupId>    
     <artifactId>yasdb-jdbc</artifactId>    
     <version>1.3</version>    
     <scope>system</scope>    
     <systemPath>D:\eclipse-workspace\single-operator-perf-test\lib\yashandb-jdbc-1.4.12-9-g261c639.jar</systemPath>    
  </dependency>

# 4. 参考文档

  [发布/上传Jar包到Maven中央仓库 - 史上最详细_oss.sonatype.org-CSDN博客](https://blog.csdn.net/ttzommed/article/details/114697533)  

  


# 5. 后续关注(可选)

跟 SE 对齐，mvn 发布不属于研发测试，不关注 mvn 发布的流程，只关注代码混淆后出的 jar 包(本地 jar 包)的测试；

1、发布的 jdbc jar 包版本号，每个版本号配置成已发布的 mvn 仓库来执行已有测试用例

2、把驱动推送到公共的maven仓库上，流程打通之后，后面搞成自动化的流水线，出了新版本就自动推，在测试时需要关注下这个流程是否拉通；

3、pom.xml 文件中   *dependency 相关的配置测试*