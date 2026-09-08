package com.sap.teched.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Entry point for the TechEd 2026 RA160 Java agent backend. */
@SpringBootApplication(scanBasePackages = {"com.sap.teched.demo", "com.sap.teched.poc"})
public class Application {

  public static void main(final String[] args) {
    SpringApplication.run(Application.class, args);
  }
}
