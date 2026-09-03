Created by 方少奎, last modified on 一月 23, 2024

IR:

SR：

## 1.     [总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

JDBC发布maven中央库，进行代码混淆打包。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

不涉及

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

对于发布公共仓库的jar包，不影响外部调用情况下进行代码混淆。并发布到maven中央公共仓库。

###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

不涉及

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#2-%E6%8E%A5%E5%8F%A3)  

不涉及

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

要求jar包通过所有测试用例，不影响业务使用。

支持从pom.xml引入anchor-jdbc依赖。

  


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#4-%E7%89%B9%E6%80%A7)  

  


###   [4.1 混淆打包](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

引入proguard-gradle:7.1.1代码混淆插件，制定混淆规则，添加混淆打包任务。

```
buildscript {
     repositories {
         maven {
             url = "https://maven.yasdb.com/repository/maven-public/"
         }
         mavenCentral()
     }
     dependencies {
         classpath 'com.guardsquare:proguard-gradle:7.1.1'
     }
 }
 -keepclassmembers enum * {
     <fields>;
     public static *** *(***);
     public static **[] values();
     public static ** valueOf(***);
 }
 -keep class com.yashandb.** {
     <fields>;
     public *;
     protected *;
 }
 -keepattributes InnerClasses
 -dontshrink
 -dontoptimize
 -keepattributes Exceptions
 -keepclasseswithmembers,includedescriptorclasses class * {
     native <methods>;
 }
```

build.gradle添加混淆打包任务

```
task proguardTask(type: ProGuardTask, dependsOn: compileJava) {
     ignorewarnings
     printmapping "$buildDir/mapping.txt"
     configuration 'proguard-rules.pro'
 ​
     libraryjars configurations.runtimeClasspath.collect()
     libraryjars "${System.getProperty('java.home')}/lib/rt.jar"
     libraryjars "${System.getProperty('java.home')}/lib/jce.jar"
 ​
     injars sourceSets.main.output
     outjars "$buildDir/libs/${rootProject.name}-${version}.jar"
 }
 jar.finalizedBy(proguardTask)
```

  


###   [4.2 发布maven中央公共仓库](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#42-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

1、注册Sonatype JIRA账号

  [https://link.zhihu.com/?target=https%3A//issues.sonatype.org/](https://link.zhihu.com/?target=https%3A//issues.sonatype.org/)  

2、申请groupId凭证

点击创建申请凭证问题单

![](https://pingcode.yasdb.com/atlas/files/public/67396c118970c2af4f52090c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUVBSUFFUUFBQUFFQUFBSUNBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFJQWdBUUFCQUFnQWdBQmdBS0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUNnQUFDQUNBQVFBQUFBQUFBb0FBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg5MTEsImV4cCI6MTc4MjMwOTcxMX0.VZfY4FkLYNt3-opDROnbdVB3a-9tZxj3K73wPPrvOO8)

Group Id =   com.yashandb.anchor-jdbc

Project URL =   https://www.yashandb.com/

SCM url =   https://git.yasdb.com/cod-x/anchor-jdbc.git

![](https://pingcode.yasdb.com/atlas/files/public/67396c11a1ad9a3311dc877a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUVBSUFFUUFBQUFFQUFBSUNBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFJQWdBUUFCQUFnQWdBQmdBS0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUNnQUFDQUNBQVFBQUFBQUFBb0FBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg5MTEsImV4cCI6MTc4MjMwOTcxMX0.VZfY4FkLYNt3-opDROnbdVB3a-9tZxj3K73wPPrvOO8)

创建问题单后需要将问题单号放到  Project URL域名下的TXT记录，以便通过审批。

3、生成密钥公私钥，并将公钥发布服务器

下载GPG密钥工具（选择对应系统版本，示例为Windows10系统）：    [GnuPG - Download](https://www.gnupg.org/download/)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c118970c2af4f52090d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUVBSUFFUUFBQUFFQUFBSUNBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFJQWdBUUFCQUFnQWdBQmdBS0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUNnQUFDQUNBQVFBQUFBQUFBb0FBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg5MTEsImV4cCI6MTc4MjMwOTcxMX0.VZfY4FkLYNt3-opDROnbdVB3a-9tZxj3K73wPPrvOO8)

打开GPG密钥工具，点击 ”文件“ - ”新建OpenGPG密钥对“，生成公私钥对。

名字：YashanDB

邮件：

密钥类型使用RSA。

![](https://pingcode.yasdb.com/atlas/files/public/67396c11a1ad9a3311dc877b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUVBSUFFUUFBQUFFQUFBSUNBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFJQWdBUUFCQUFnQWdBQmdBS0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUNnQUFDQUNBQVFBQUFBQUFBb0FBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg5MTEsImV4cCI6MTc4MjMwOTcxMX0.VZfY4FkLYNt3-opDROnbdVB3a-9tZxj3K73wPPrvOO8)

将公钥发布到服务器，以便OSSRH验证使用。

gpg --keyserver     [hkp://keyserver.ubuntu.com:11371](hkp://keyserver.ubuntu.com:11371)     --send-keys [密钥指纹后16位]

检查公钥是否发布成功。

gpg --keyserver     [hkp://keyserver.ubuntu.com:11371](hkp://keyserver.ubuntu.com:11371)     --recv-keys [密钥指纹后16位]

导出私钥，私钥保存项目中，以便gradle发布时使用。

![](https://pingcode.yasdb.com/atlas/files/public/67396c11a1ad9a3311dc877c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUVBSUFFUUFBQUFFQUFBSUNBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFJQWdBUUFCQUFnQWdBQmdBS0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUNnQUFDQUNBQVFBQUFBQUFBb0FBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg5MTEsImV4cCI6MTc4MjMwOTcxMX0.VZfY4FkLYNt3-opDROnbdVB3a-9tZxj3K73wPPrvOO8)

![](https://pingcode.yasdb.com/atlas/files/public/67396c118970c2af4f52090e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUVBSUFFUUFBQUFFQUFBSUNBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFJQWdBUUFCQUFnQWdBQmdBS0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUNnQUFDQUNBQVFBQUFBQUFBb0FBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg5MTEsImV4cCI6MTc4MjMwOTcxMX0.VZfY4FkLYNt3-opDROnbdVB3a-9tZxj3K73wPPrvOO8)

4、配置gradle

在gradle.properties文件添加配置

sonatypeUsername  =[sonatype帐号]    
  sonatypePassword  =[sonatype密码]    
    
  signing.keyId  =[密钥指纹后8位]    
  signing.password  =[密钥保护密钥，GPG生成密钥对设置的密码]    
  signing.secretKeyRingFile   = [私钥文件路径]

在build.gradle文件添加配置

```
apply plugin: 'maven-publish'
apply plugin: 'signing'

task sourcesJar(type: Jar) {
    classifier = 'sources'
}

task javadocJar(type: Jar) {
    classifier = 'javadoc'
}
group = 'com.yashandb'

publishing {
    publications {
        mavenJava(MavenPublication) {
            from components.java
            artifact sourcesJar
            artifact javadocJar
            pom {
                name = 'yashandb-jdbc'
                description = 'yashandb jdbc'
                url = 'https://maven.yashandb.com'
                licenses {
                    license {
                        name = 'The Apache License, Version 2.0'
                        url = 'http://www.apache.org/licenses/LICENSE-2.0.txt'
                    }
                }
                developers {
                    developer {
                        name = 'YashanDB'
                        email = 'yashandb@sics.ac.cn'
                    }
                }
                scm {
                    url = 'https://maven.yashandb.com'
                }
            }
        }
    }
    repositories {
        maven {
            name = 'yashandb-jdbc'
            url "https://s01.oss.sonatype.org/service/local/staging/deploy/maven2/"
            credentials {
                username "${sonatypeUsername}"
                password "${sonatypePassword}"
            }
        }
    }
}

signing {
    sign publishing.publications.mavenJava
}

javadoc {
    options.addStringOption("charset", "UTF-8")
}
```

  


5、发布jar

执行 gradle publish

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

  


##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

## Attachments:

## Comments:

|  [](null)  ,参考：    [https://davidli2010.github.io/maven-notes/11-%E5%90%91%E4%B8%AD%E5%A4%AE%E4%BB%93%E5%BA%93%E5%8F%91%E5%B8%83%E8%BD%AF%E4%BB%B6%E5%8C%85.html](https://davidli2010.github.io/maven-notes/11-%E5%90%91%E4%B8%AD%E5%A4%AE%E4%BB%93%E5%BA%93%E5%8F%91%E5%B8%83%E8%BD%AF%E4%BB%B6%E5%8C%85.html)    。,不想发布sources，也要打包一个空sources jar包，以通过检查。,Posted by liweichao at 一月 11, 2024 20:31|
|---|
|  [](null)  ,Group应该是com.yashandb，不要带上jdbc，未来需要发布到mvn repo的jar包都统一在这个group里，例如jpa适配包。,驱动包名是yashandb-jdbc，不要出现anchor字眼。,Posted by liweichao at 一月 12, 2024 10:26|
|  [](null)  ,  [https://git.yasdb.com/cod-x/anchor-jdbc.git](https://git.yasdb.com/cod-x/anchor-jdbc.git)    是内部仓库地址，外部不可访问，不应对外暴露。,Posted by liweichao at 一月 12, 2024 10:29|
